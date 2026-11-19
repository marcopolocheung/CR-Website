import sys,re
from pathlib import Path
script=Path(sys.argv[1]).resolve();art=Path(sys.argv[2]).resolve();rest=sys.argv[3:]
source=script.read_text()
source=re.sub(r"ART=ROOT/'docs/internal-tools-overhaul/evidence/step-[0-9]+/screens'",'ART=Path('+repr(str(art))+')',source)
sys.argv=[str(script),*rest];sys.path.insert(0,str(script.parent))
exec(compile(source,str(script),'exec'),{'__file__':str(script),'__name__':'__main__'})
