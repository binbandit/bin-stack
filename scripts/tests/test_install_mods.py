import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


REPO = Path(__file__).resolve().parents[2]
FAKE_CLAUDE = """import json
import os
from pathlib import Path
import sys

args = sys.argv[1:]
with Path(os.environ["CLAUDE_CALLS"]).open("a") as log:
    log.write(json.dumps(args) + "\\n")
if args[:3] == ["plugin", "marketplace", "add"]:
    sys.exit(int(os.environ.get("FAIL_MARKETPLACE", "0")))
if args[:2] == ["plugin", "install"]:
    sys.exit(int(os.environ.get("FAIL_INSTALL", "0")))
sys.exit("unexpected Claude command")
"""


class InstallModsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="bin-stack install ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.repo = self.root / "clone with spaces"
        self.script = self.repo / "scripts/install-mods.sh"
        self.script.parent.mkdir(parents=True)
        shutil.copy2(REPO / "scripts/install-mods.sh", self.script)
        self.catalog_path = self.repo / "mods/.claude-plugin/marketplace.json"
        self.catalog_path.parent.mkdir(parents=True)
        self.catalog = json.loads((REPO / "mods/.claude-plugin/marketplace.json").read_text())
        self.catalog_path.write_text(json.dumps(self.catalog))
        for plugin in self.catalog["plugins"]:
            name = plugin["name"]
            target = self.manifest(name)
            target.parent.mkdir(parents=True)
            shutil.copy2(REPO / "mods" / name / ".claude-plugin/plugin.json", target)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        (self.bin / "dirname").symlink_to(shutil.which("dirname"))
        (self.bin / "python3").symlink_to(sys.executable)
        self.claude = self.bin / "claude"
        self.claude.write_text(f"#!{sys.executable}\n" + FAKE_CLAUDE)
        self.claude.chmod(0o755)
        self.calls_path = self.root / "calls.jsonl"
        self.env = dict(os.environ, PATH=str(self.bin), CLAUDE_CALLS=str(self.calls_path))
        self.env["HOME"] = str(self.root / "home")
        self.env["CLAUDE_CONFIG_DIR"] = str(self.root / "config")

    def manifest(self, name):
        return self.repo / "mods" / name / ".claude-plugin/plugin.json"

    def run_installer(self, *names):
        return subprocess.run(
            ["/bin/bash", str(self.script), *names],
            cwd=self.root,
            env=self.env,
            capture_output=True,
            text=True,
            timeout=10,
        )

    def calls(self):
        if not self.calls_path.exists():
            return []
        return [json.loads(line) for line in self.calls_path.read_text().splitlines()]

    def assert_rejected(self, *names):
        result = self.run_installer(*names)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertEqual(self.calls(), [], result.stderr)
        return result

    def test_no_names_shows_usage_without_installing(self):
        result = self.assert_rejected()
        self.assertIn("Usage:", result.stderr)

    def test_help_does_not_need_claude_or_python(self):
        self.claude.unlink()
        (self.bin / "python3").unlink()
        result = self.run_installer("--help")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("MOD [MOD ...]", result.stdout)
        self.assertEqual(self.calls(), [])

    def test_list_matches_marketplace_without_claude(self):
        self.claude.unlink()
        result = self.run_installer("--list")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines(), [p["name"] for p in self.catalog["plugins"]])
        self.assertEqual(self.calls(), [])

    def test_only_named_mods_are_installed_once_in_requested_order(self):
        result = self.run_installer("tool-lines", "glamour-dark", "tool-lines")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls(), [
            ["plugin", "marketplace", "add", str(self.repo / "mods"), "--scope", "user"],
            ["plugin", "install", "tool-lines@bin-stack", "--scope", "user"],
            ["plugin", "install", "glamour-dark@bin-stack", "--scope", "user"],
        ])

    def test_invalid_requests_make_no_claude_calls(self):
        for name in ("missing", "slopothon-footer", "../tool-lines", "", "--all", "--list", "--help", "tool-lines@other", "tool-lines\nglamour-dark"):
            with self.subTest(name=name):
                result = self.assert_rejected("tool-lines", name)
                self.assertIn("unknown mod(s):", result.stderr)

    def test_unregistered_directory_is_not_installable(self):
        orphan = self.manifest("orphan")
        orphan.parent.mkdir(parents=True)
        orphan.write_text(json.dumps({"name": "orphan"}))
        self.assert_rejected("orphan")

    def test_all_manifests_are_checked_before_marketplace_registration(self):
        for content in (None, "{", '{"name": "other"}'):
            with self.subTest(content=content):
                manifest = self.manifest("glamour-dark")
                if content is None:
                    manifest.unlink()
                else:
                    manifest.write_text(content)
                self.assert_rejected("tool-lines", "glamour-dark")

    def test_invalid_marketplace_is_rejected_without_changes(self):
        for content in ("{", '{"name": "other", "plugins": []}'):
            with self.subTest(content=content):
                self.catalog_path.write_text(content)
                self.assert_rejected("tool-lines")

    def test_nonlocal_source_is_rejected_without_changes(self):
        next(p for p in self.catalog["plugins"] if p["name"] == "tool-lines")["source"] = "../elsewhere"
        self.catalog_path.write_text(json.dumps(self.catalog))
        self.assert_rejected("tool-lines")

    def test_missing_dependencies_make_no_claude_calls(self):
        self.claude.unlink()
        result = self.assert_rejected("tool-lines")
        self.assertIn("claude is not on PATH", result.stderr)
        (self.bin / "python3").unlink()
        result = self.assert_rejected("tool-lines")
        self.assertIn("python3 is not on PATH", result.stderr)

    def test_marketplace_failure_stops_before_installing(self):
        self.env["FAIL_MARKETPLACE"] = "7"
        result = self.run_installer("tool-lines")
        self.assertEqual(result.returncode, 7)
        self.assertEqual(len(self.calls()), 1)
        self.assertEqual(self.calls()[0][:3], ["plugin", "marketplace", "add"])

    def test_install_failure_stops_before_the_next_mod(self):
        self.env["FAIL_INSTALL"] = "9"
        result = self.run_installer("tool-lines", "glamour-dark")
        self.assertEqual(result.returncode, 9)
        self.assertEqual(len(self.calls()), 2)
        self.assertEqual(self.calls()[1][2], "tool-lines@bin-stack")

    def test_footer_is_removed_and_banner_is_retained(self):
        names = [p["name"] for p in self.catalog["plugins"]]
        self.assertNotIn("slopothon-footer", names)
        self.assertFalse((REPO / "mods/slopothon-footer/.claude-plugin/plugin.json").exists())
        self.assertIn("slopothon", names)
        self.assertTrue((REPO / "mods/slopothon/hooks/register.ts").is_file())


if __name__ == "__main__":
    unittest.main()
