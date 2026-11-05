import os
from pathlib import Path
import subprocess
import tempfile
import unittest


REPO = Path(__file__).resolve().parents[2]


class InstallCodexRulesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="bin-stack codex ")
        self.addCleanup(self.temp.cleanup)
        self.rules = Path(self.temp.name) / "rules"
        self.rules.mkdir()

    def run_script(self):
        env = {**os.environ, "CODEX_HOME": self.temp.name}
        return subprocess.run(
            [str(REPO / "scripts/install-codex-rules.sh")],
            capture_output=True, text=True, check=True, env=env,
        ).stdout

    def test_copies_rules_and_removes_stale_ones_only(self):
        source = REPO / "codex/rules/herdr.rules"
        (self.rules / "herdr.rules").write_text("# mine\n")
        (self.rules / "bin-stack-gone.rules").write_text("# stale\n")
        (self.rules / "bin-stack-herdr.rules").symlink_to(source)

        self.run_script()

        installed = self.rules / "bin-stack-herdr.rules"
        self.assertFalse(installed.is_symlink())
        self.assertEqual(installed.read_text(), source.read_text())
        self.assertFalse((self.rules / "bin-stack-gone.rules").exists())
        self.assertEqual((self.rules / "herdr.rules").read_text(), "# mine\n")
        self.assertIn("ok", self.run_script())


if __name__ == "__main__":
    unittest.main()
