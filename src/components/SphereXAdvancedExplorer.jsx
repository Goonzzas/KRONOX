import originalVisualizerHtml from '../../SphereX-Visualizations-main/kronox_visor_cientifico.html?raw';
import '../styles/spherexAdvancedExplorer.css';

export default function SphereXAdvancedExplorer({ targetName, ra, dec, onClose }) {
  const focusMissionTarget = (frame) => {
    if (!Number.isFinite(ra) || !Number.isFinite(dec)) return;
    frame.contentWindow?.postMessage(
      {
        type: 'KRONOX_ATLAS_REGION',
        ra,
        dec,
        fov: 0.5,
        target: targetName,
      },
      '*',
    );
  };

  return (
    <div className="kronoxExpeditionShade kronoxSphereXExplorerShade" role="dialog" aria-modal="true">
      <section className="kronoxExpeditionSheet kronoxSphereXExplorerSheet">
        <header className="kronoxExpeditionHeader kronoxSphereXExplorerHeader">
          <div className="kronoxHeaderBadge">
            <span className="kronoxCompassIcon" aria-hidden="true">
              ✦
            </span>
            <div className="kronoxHeaderText">
              <span className="kronoxHeaderSub">ESTACIÓN DE INVESTIGACIÓN · DR1</span>
              <h2 className="kronoxHeaderTitle">Explorador espectral de todo el cielo</h2>
            </div>
          </div>
          <button type="button" className="kronoxCloseButton" onClick={onClose}>
            <span aria-hidden="true">←</span>
            <span className="kronoxCloseLabel">Regresar al espacio 3D</span>
          </button>
        </header>

        <div className="kronoxSphereXExplorerNotice">
          <span className="kronoxSphereXExplorerTag">VISOR ORIGINAL · SPHEREx DR1</span>
          <span>
            Cubo de 102 canales, mapas HiPS, inspección de píxel y espectro. El visor usa el servidor
            Python de SphereX para catálogo y productos FITS.
          </span>
          <details>
            <summary>Procedencia y lectura de los datos</summary>
            <p>
              Las imágenes y valores inspeccionados proceden de productos del archivo IRSA/SPHEREx.
              La composición RGB, las escalas de visualización y las capas de análisis son
              transformaciones para explorar esos datos; los colores no son ópticos y las
              representaciones de similitud no son resultados oficiales de NASA.
            </p>
          </details>
        </div>

        <div className="kronoxSphereXExplorerScreen">
          <iframe
            title="Visor científico SPHEREx: 102 canales y datos DR1"
            srcDoc={originalVisualizerHtml}
            sandbox="allow-scripts allow-forms allow-downloads allow-popups"
            referrerPolicy="no-referrer"
            onLoad={(event) => focusMissionTarget(event.currentTarget)}
          />
        </div>
      </section>
    </div>
  );
}
