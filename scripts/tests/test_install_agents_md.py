from pathlib import Path
import subprocess
import tempfile
import unittest


REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "scripts/install-agents-md.sh"
SNIPPET = (REPO / "agents-md/herdr.md").read_text().strip()
BLOCK = f"<!-- BEGIN bin-stack:herdr -->\n{SNIPPET}\n<!-- END bin-stack:herdr -->\n"


class InstallAgentsMdTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="bin-stack agents ")
        self.addCleanup(self.temp.cleanup)
        self.file = Path(self.temp.name) / "AGENTS.md"

    def run_script(self, *args, check=True):
        result = subprocess.run(
            [str(SCRIPT), *args], capture_output=True, text=True, check=False
        )
        if check:
            self.assertEqual(result.returncode, 0, result.stderr)
        return result

    def test_appends_once_then_leaves_the_file_alone(self):
        self.file.write_text("# Mine\n\n- keep me\n")

        self.assertTrue(self.run_script("herdr", str(self.file)).stdout.startswith("append"))
        self.assertEqual(self.file.read_text(), "# Mine\n\n- keep me\n\n" + BLOCK)

        self.assertTrue(self.run_script("herdr", str(self.file)).stdout.startswith("ok"))
        self.assertEqual(self.file.read_text(), "# Mine\n\n- keep me\n\n" + BLOCK)

    def test_replaces_a_stale_block_in_place(self):
        stale = "<!-- BEGIN bin-stack:herdr -->\nold\n<!-- END bin-stack:herdr -->\n"
        self.file.write_text("# Top\n\n" + stale + "\n## Bottom\n")

        self.assertTrue(self.run_script("herdr", str(self.file)).stdout.startswith("update"))
        self.assertEqual(self.file.read_text(), "# Top\n\n" + BLOCK + "\n## Bottom\n")

    def test_edits_through_a_symlink(self):
        real = Path(self.temp.name) / "real.md"
        real.write_text("# Real\n")
        self.file.symlink_to(real)

        self.run_script("herdr", str(self.file))

        self.assertTrue(self.file.is_symlink())
        self.assertEqual(real.read_text(), "# Real\n\n" + BLOCK)

    def test_remove_rejoins_neighbours(self):
        self.file.write_text("# Top\n\n" + BLOCK + "\n## Bottom\n")

        self.assertTrue(self.run_script("--remove", "herdr", str(self.file)).stdout.startswith("remove"))
        self.assertEqual(self.file.read_text(), "# Top\n\n## Bottom\n")

        self.assertTrue(self.run_script("--remove", "herdr", str(self.file)).stdout.startswith("ok"))

    def test_refuses_unbalanced_markers(self):
        broken = "# Top\n<!-- BEGIN bin-stack:herdr -->\nhalf\n"
        self.file.write_text(broken)

        result = self.run_script("herdr", str(self.file), check=False)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unbalanced", result.stderr)
        self.assertEqual(self.file.read_text(), broken)

    def test_rejects_unknown_snippets(self):
        result = self.run_script("../herdr", str(self.file), check=False)

        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.file.exists())


if __name__ == "__main__":
    unittest.main()
