import React, { useState } from 'react';
import { loadExplorerProfile, saveExplorerProfile } from '../state/campaignState.js';
import { unlockAchievement } from '../utils/gameAchievements.js';

/**
 * KRONOX Commercial-Grade Video Game Main Menu & Explorer Registration.
 *
 * Implements:
 * 1. Nueva Expedición: Opens Kronox IA registration sequence (Alias + Skill level).
 * 2. Continuar Expedición: Resumes saved profile & campaign progress.
 * 3. Ajustes: Direct access to graphics, audio, voice and controls.
 * 4. Créditos: Lore of Proyecto Horizonte & tribute to NASA SPHEREx mission.
 */
export default function MainMenu({
  open = true,
  onStartNewExpedition,
  onResumeExpedition,
  onContinueExpedition,
  onOpenSettings,
  language = 'es',
}) {
  const [showRegistration, setShowRegistration] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [alias, setAlias] = useState('');
  const [skillLevel, setSkillLevel] = useState('intermediate'); // beginner | intermediate | advanced
  const existingProfile = loadExplorerProfile();

  if (!open) return null;

  const handleConfirmRegistration = (e) => {
    e.preventDefault();
    const finalAlias = alias.trim() || (language === 'es' ? 'Explorador Horizonte' : 'Horizon Explorer');
    const profile = {
      alias: finalAlias,
      skillLevel,
      registeredAt: Date.now(),
    };
    saveExplorerProfile(profile);
    unlockAchievement('ACH_FIRST_CONTACT');
    setShowRegistration(false);
    onStartNewExpedition?.(profile);
  };

  return (
    <div className="kronox-main-menu-overlay" role="dialog" aria-modal="true" aria-label="Menú principal de KRONOX">
      <div className="kronox-main-menu-content">
        <header className="kronox-main-menu-header">
          <span className="kronox-main-menu-badge">PROYECTO HORIZONTE · CRUCERO CIENTÍFICO 120M</span>
          <h1 className="kronox-main-title">KRONOX</h1>
          <p className="kronox-main-subtitle">
            Exploración Espacial, Microgravedad y Ciencia Astronómica con NASA SPHEREx
          </p>
        </header>

        {!showRegistration && !showCredits && (
          <nav className="kronox-main-nav-buttons" aria-label="Opciones del menú principal">
            <button
              type="button"
              className="kronox-main-btn primary"
              onClick={() => setShowRegistration(true)}
            >
              <span className="btn-icon">✦</span>
              <div className="btn-text">
                <strong>INICIAR EXPEDICIÓN</strong>
                <small>Registrar explorador e iniciar travesía con Kronox IA</small>
              </div>
            </button>

            <button
              type="button"
              className="kronox-main-btn"
              disabled={!existingProfile}
              onClick={() => (onResumeExpedition || onContinueExpedition)?.(existingProfile)}
              title={existingProfile ? `Continuar expedición de ${existingProfile.alias}` : 'No hay partida guardada'}
            >
              <span className="btn-icon">▶</span>
              <div className="btn-text">
                <strong>Continuar Expedición</strong>
                <small>
                  {existingProfile
                    ? `Reanudar como ${existingProfile.alias}`
                    : 'Sin registro previo disponible'}
                </small>
              </div>
            </button>

            <button
              type="button"
              className="kronox-main-btn secondary"
              onClick={onOpenSettings}
            >
              <span className="btn-icon">⚙</span>
              <div className="btn-text">
                <strong>Ajustes y Configuración</strong>
                <small>Gráficos, audio, accesibilidad y controles</small>
              </div>
            </button>

            <button
              type="button"
              className="kronox-main-btn secondary"
              onClick={() => setShowCredits(true)}
            >
              <span className="btn-icon">ℹ</span>
              <div className="btn-text">
                <strong>Créditos y Proyecto Horizonte</strong>
                <small>Misión NASA SPHEREx y arquitectura científica</small>
              </div>
            </button>
          </nav>
        )}

        {/* REGISTRATION MODAL */}
        {showRegistration && (
          <section className="kronox-registration-card" role="region" aria-label="Registro de explorador">
            <h3>Registro de Nuevo Explorador</h3>
            <p className="kronox-reg-intro">
              Kronox IA: «Te doy la bienvenida al Proyecto Horizonte. Antes de transferir los mandos de la nave KRONOX, por favor introduce tu identificación y selecciona tu nivel de formación astronómica para calibrar las guías de a bordo.»
            </p>

            <form onSubmit={handleConfirmRegistration}>
              <div className="kronox-form-group">
                <label htmlFor="explorer-alias">Alias o Nombre del Explorador:</label>
                <input
                  id="explorer-alias"
                  type="text"
                  maxLength={32}
                  className="kronox-reg-input"
                  placeholder="Ej. Comandante Elena / Explorador 01"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="kronox-form-group">
                <label>Nivel de Formación Astronómica:</label>
                <div className="kronox-skill-choices">
                  <label className={`skill-card ${skillLevel === 'beginner' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="skill"
                      value="beginner"
                      checked={skillLevel === 'beginner'}
                      onChange={() => setSkillLevel('beginner')}
                    />
                    <strong>Principiante</strong>
                    <small>Explicaciones detalladas de conceptos básicos y soporte guiado continuo.</small>
                  </label>

                  <label className={`skill-card ${skillLevel === 'intermediate' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="skill"
                      value="intermediate"
                      checked={skillLevel === 'intermediate'}
                      onChange={() => setSkillLevel('intermediate')}
                    />
                    <strong>Conocimientos Básicos</strong>
                    <small>Equilibrio entre rigor científico y autonomía en la exploración.</small>
                  </label>

                  <label className={`skill-card ${skillLevel === 'advanced' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="skill"
                      value="advanced"
                      checked={skillLevel === 'advanced'}
                      onChange={() => setSkillLevel('advanced')}
                    />
                    <strong>Experiencia Avanzada</strong>
                    <small>Enfoque directo en astrometría, análisis espectral FITS y fotometría.</small>
                  </label>
                </div>
              </div>

              <div className="kronox-reg-actions">
                <button type="button" className="kronox-pause-secondary-btn" onClick={() => setShowRegistration(false)}>
                  Volver
                </button>
                <button type="submit" className="kronox-main-btn primary submit-btn">
                  INICIAR EXPEDICIÓN
                </button>
              </div>
            </form>
          </section>
        )}

        {/* CREDITS MODAL */}
        {showCredits && (
          <section className="kronox-registration-card" role="region" aria-label="Créditos del videojuego">
            <h3>Proyecto Horizonte & Reconocimiento Científico</h3>
            <div className="kronox-credits-body">
              <p>
                <strong>KRONOX</strong> es un videojuego de exploración espacial de ciencia ficción que rinde homenaje a la astrofísica observacional y a la misión <strong>NASA SPHEREx</strong> (Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer).
              </p>
              <p>
                <strong>Proyecto Horizonte</strong> es la iniciativa internacional ficticia dentro del lore del videojuego que impulsa la expedición de la nave modular de 120 metros.
              </p>
              <p>
                Los datos espectrales, imágenes FITS y catálogos estelares proceden de archivos científicos públicos (NASA/IPAC Infrared Science Archive - IRSA, Gaia DR3, CatWISE2020).
              </p>
            </div>
            <div className="kronox-reg-actions">
              <button type="button" className="kronox-main-btn primary" onClick={() => setShowCredits(false)}>
                Entendido
              </button>
            </div>
          </section>
        )}

        <footer className="kronox-main-footer">
          <span>KRONOX v2.0 · 120m Modular Science Cruiser · Época J2000.0</span>
        </footer>
      </div>
    </div>
  );
}
