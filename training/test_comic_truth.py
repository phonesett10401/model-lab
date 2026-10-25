"""True text from Pepper&Carrot's English SVG sources. Run: python test_comic_truth.py"""
from comic_truth import svg_text, svg_url

svg = '''<svg xmlns="http://www.w3.org/2000/svg">
  <text x="1" y="2"><tspan>HELLO</tspan> <tspan>THERE</tspan></text>
  <g><text>Bye</text></g>
  <text>   </text>
  <text><tspan>It's too</tspan><tspan>hard...</tspan></text>
</svg>'''
assert svg_text(svg) == ['HELLO THERE', 'Bye', "It's too hard..."], svg_text(svg)
assert svg_url('https://www.peppercarrot.com/0_sources/ep01_Potion-of-Flight/', 'pepper_E01P03.jpg') == \
    'https://framagit.org/peppercarrot/webcomics/-/raw/master/ep01_Potion-of-Flight/lang/en/E01P03.svg'
print('comic truth checks passed')
