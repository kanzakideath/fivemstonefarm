from pathlib import Path
import re

path = Path('src/local-navigation/LocalNavigation.cs')
source = path.read_text(encoding='utf-8-sig')
# These are helper methods, not overrides of WinForms Control.Capture/Move.
source = re.sub(r'\bCapture\(', 'CaptureScenery(', source)
source = re.sub(r'(?<!\.)\bMove\(', 'MoveCamera(', source)
path.write_text(source, encoding='utf-8', newline='\n')
