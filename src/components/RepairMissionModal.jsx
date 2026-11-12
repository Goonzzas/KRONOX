import React, { useState } from 'react';
import { unlockAchievement } from '../utils/gameAchievements.js';
import { advanceCampaignLevel, loadCampaignProgress, saveCampaignProgress } from '../state/campaignState.js';

/**
 * Interactive Prologue Repair Mission Modal (Deck 02 Optical Benchmark).
 * Hands-on zero-G technical service:
 * 1. Diagnostic scan with portable spectral scanner.
 * 2. Unmounting degraded optical coupler with multi-tool.
 * 3. Installing replacement quantum coupler from player inventory.
 * 4. Frequency calibration and system clearance by Kronox IA.
 */
export default function RepairMissionModal({
  open = false,
  isOpen,
  onClose,
  onRepairCompleted,
  onMissionComplete,
  language = 'es',
}) {
  const [stage, setStage] = useState(1); // 1: Scan, 2: Extract, 3: Install, 4: Calibrate, 5: Finished
  const [scanProgress, setScanProgress] = useState(0);
  const [toolTorque, setToolTorque] = useState(0);
  const [calibratedFreq, setCalibratedFreq] = useState(164.2);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const modalOpen = Boolean(open || isOpen);
  if (!modalOpen) return null;

  const handleRunDiagnostic = () => {
    setFeedbackMsg('Iniciando barrido espectral del bus óptico...');
    let p = 0;
    const interval = setInterval(() => {
      p += 20;
      setScanProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setFeedbackMsg('Fallo detectado: Acoplador óptico desalineado. Resonancia caída a 164.2 THz (-14.8%).');
        setStage(2);
      }
    }, 120);
  };

  const handleUseMultiTool = () => {
    setToolTorque((prev) => {
      const next = prev + 35;
      if (next >= 100) {
        setFeedbackMsg('Pernos magnéticos liberados. Acoplador óptico desgastado extraído con éxito.');
        setStage(3);
        return 100;
      }
      setFeedbackMsg(`Aplicando torque de torsión fría... ${next}%`);
      return next;
    });
  };

  const handleInstallReplacement = () => {
    setFeedbackMsg('Instalando Acoplador Óptico Cuántico de niobato de litio desde el inventario...');
    setTimeout(() => {
      setFeedbackMsg('Acoplador acoplado a la guía de ondas. Listo para calibración de frecuencia.');
      setStage(4);
    }, 600);
  };

  const handleCalibrateTelemetry = () => {
    setFeedbackMsg('Alineando fase óptica con la referencia estelar J2000.0...');
    let f = 164.2;
    const interval = setInterval(() => {
      f = Math.min(193.4, f + 5.8);
      setCalibratedFreq(Number(f.toFixed(1)));
      if (f >= 193.4) {
        clearInterval(interval);
        setFeedbackMsg('¡Telemetría verificada! Resonancia estabilizada en 193.4 THz (99.8% de eficiencia).');
        setStage(5);

        // Unlock Achievement and advance campaign
        unlockAchievement('ACH_ONBOARD_TECH');
        const prog = loadCampaignProgress();
        prog.prologueRepaired = true;
        saveCampaignProgress(prog);
        advanceCampaignLevel(0);
        (onRepairCompleted || onMissionComplete)?.();
      }
    }, 100);
  };

  return (
    <div className="kronox-repair-modal-overlay" role="dialog" aria-modal="true" aria-label="Misión de puesta en servicio">
      <div className="kronox-repair-card">
        <header className="kronox-repair-header">
          <span className="kronox-repair-eyebrow">CUBIERTA 02 · BANCO DE REFERENCIA ÓPTICA</span>
          <h2>Puesta en Servicio: Sensor de Telemetría</h2>
          <p>
            Antes de iniciar la travesía cósmica, Kronox IA requiere que el sensor de referencia óptica esté calibrado.
          </p>
        </header>

        <div className="kronox-repair-body">
          <div className="kronox-repair-progress-track">
            <span className={`step-dot ${stage >= 1 ? 'done' : ''}`}>1. Escáner</span>
            <span className={`step-dot ${stage >= 2 ? 'done' : ''}`}>2. Desmontaje</span>
            <span className={`step-dot ${stage >= 3 ? 'done' : ''}`}>3. Repuesto</span>
            <span className={`step-dot ${stage >= 4 ? 'done' : ''}`}>4. Calibración</span>
          </div>

          <div className="kronox-repair-stage-box">
            {stage === 1 && (
              <div>
                <p>Apunta el escáner portátil hacia el módulo de fibra óptica para diagnosticar la falla:</p>
                <div className="kronox-meter-bar">
                  <div className="kronox-meter-fill" style={{ width: `${scanProgress}%` }} />
                </div>
                <button type="button" className="kronox-repair-btn" onClick={handleRunDiagnostic}>
                  📡 Activar Escáner Espectral
                </button>
              </div>
            )}

            {stage === 2 && (
              <div>
                <p>Utiliza la multiherramienta de torque para desatornillar el acoplador dañado:</p>
                <div className="kronox-meter-bar">
                  <div className="kronox-meter-fill orange" style={{ width: `${toolTorque}%` }} />
                </div>
                <button type="button" className="kronox-repair-btn" onClick={handleUseMultiTool}>
                  🔧 Aplicar Torque con Multiherramienta ({toolTorque}%)
                </button>
              </div>
            )}

            {stage === 3 && (
              <div>
                <p>Selecciona el Acoplador Óptico Cuántico de repuesto de tu inventario:</p>
                <button type="button" className="kronox-repair-btn success" onClick={handleInstallReplacement}>
                  💎 Insertar Acoplador de Repuesto
                </button>
              </div>
            )}

            {stage === 4 && (
              <div>
                <p>Calibrando frecuencia resonante óptica:</p>
                <div className="kronox-frequency-display">
                  <span>Frecuencia actual:</span>
                  <strong>{calibratedFreq} THz</strong>
                  <small>(Objetivo nominal: 193.4 THz)</small>
                </div>
                <button type="button" className="kronox-repair-btn primary" onClick={handleCalibrateTelemetry}>
                  ⚡ Sincronizar Frecuencia con Kronox IA
                </button>
              </div>
            )}

            {stage === 5 && (
              <div className="kronox-repair-success-screen">
                <div className="kronox-success-check">✓</div>
                <h3>¡Puesta en Servicio Completada!</h3>
                <p>
                  Kronox IA: «Excelente trabajo, explorador. La telemetría óptica está en línea y los sistemas de orientación responden nominalmente. La nave KRONOX está lista para la expedición espacial.»
                </p>
                <div className="kronox-achievement-badge">
                  <span>🏆 Logro Desbloqueado:</span>
                  <strong>Técnico de a Bordo</strong>
                </div>
                <button type="button" className="kronox-repair-btn primary" onClick={onClose}>
                  Continuar Expedición
                </button>
              </div>
            )}
          </div>

          {feedbackMsg && <div className="kronox-repair-feedback" role="status">{feedbackMsg}</div>}
        </div>

        <footer className="kronox-repair-footer">
          <button type="button" className="kronox-pause-secondary-btn" onClick={onClose}>
            Cerrar [ESC]
          </button>
        </footer>
      </div>
    </div>
  );
}

