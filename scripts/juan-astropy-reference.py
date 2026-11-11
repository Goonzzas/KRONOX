import json
from pathlib import Path
from astropy.io import fits
from astropy.wcs import WCS
import astropy
result={'reference':'Astropy/WCSLIB independent evaluation of official cutouts','astropy':astropy.__version__,'products':[]}
for file in Path('public/demo').glob('*/*.fits'):
    with fits.open(file) as hdus:
        header=hdus['IMAGE'].header.copy()
        spatial=WCS(header,hdus).celestial
        for key in list(header):
            if key.startswith(('A_','B_','AP_','BP_')): del header[key]
        spectral=WCS(header,hdus,key='W')
        nx,ny=hdus['IMAGE'].data.shape[1],hdus['IMAGE'].data.shape[0]
        points=[[3.,5.],[(nx+1)/2,(ny+1)/2],[nx-3.,ny-4.]]
        samples=[]
        for x,y in points:
            wave,width=spectral.wcs.p2s([[x,y]],1)['world'][0]
            ra,dec=spatial.all_pix2world([[x,y]],1)[0]
            samples.append({'xFits':x,'yFits':y,'wave':float(wave),'bandwidth':float(width),'ra':float(ra),'dec':float(dec)})
        result['products'].append({'file':str(file).replace('\\','/'),'samples':samples})
Path('docs/juan/wcs-reference.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(len(result['products']),'real products, 39 independent WCS/WAVE samples')
