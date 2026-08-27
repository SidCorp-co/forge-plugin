#!/usr/bin/env python3
"""Entry point. Keeps the package importable without installation."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vi_cli.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
