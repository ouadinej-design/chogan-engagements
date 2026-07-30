"use client";

import { useRef, useState, useCallback } from "react";
import jsPDF from "jspdf";
import { NADA_PASSWORD, DUREE_VERROU_MS } from "@/lib/config";
import {
  EngagementData,
  isPinValide,
  estAdmin,
  sceller,
  dechiffrer,
} from "@/lib/crypto";

type Profil = "nada" | "consultante" | null;
type Tab = "write" | "read";

interface Toast {
  id: number;
  message: string;
  kind: "success" | "error" | "info";
}

export default function ChoganEngagements() {
  // ---- Navigation / profil ----
  const [tab, setTab] = useState<Tab>("write");
  const [modalNadaOpen, setModalNadaOpen] = useState(false);
  const [nadaPasswordInput, setNadaPasswordInput] = useState("");

  // ---- Formulaire d'écriture ----
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [engagements, setEngagements] = useState("");
  const [keyConsultante, setKeyConsultante] = useState("");
  const [sealed, setSealed] = useState(false);
  const [downloadedFilename, setDownloadedFilename] = useState("");
  const [fallbackText, setFallbackText] = useState("");

  // ---- Lecture / déchiffrement ----
  const [payload, setPayload] = useState("");
  const [decryptKeyConsultante, setDecryptKeyConsultante] = useState("");
  const [decryptKeyNada, setDecryptKeyNada] = useState("");
  const [statusMessage, setStatusMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Toasts ----
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const showToast = useCallback(
    (message: string, kind: Toast["kind"] = "info") => {
      const id = ++toastId.current;
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 3500);
    },
    []
  );

  // ---- Overlay plein écran (bouteille) ----
  const [fsOpen, setFsOpen] = useState(false);
  const [fsShowFinal, setFsShowFinal] = useState(false);
  const [fsData, setFsData] = useState<{
    prenom: string;
    nom: string;
    titre: string;
    date: string;
    texte: string;
  } | null>(null);
  const fsFloatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Audio synthétisé ----
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vaguesNodeRef = useRef<{
    noise: AudioBufferSourceNode;
    gain: GainNode;
  } | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const arreterVagues = useCallback(() => {
    if (!vaguesNodeRef.current) return;
    try {
      const ctx = getAudioCtx();
      const { noise, gain } = vaguesNodeRef.current;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      noise.stop(ctx.currentTime + 0.35);
    } catch {
      /* ignore */
    }
    vaguesNodeRef.current = null;
  }, [getAudioCtx]);

  const demarrerVagues = useCallback(() => {
    arreterVagues();
    try {
      const ctx = getAudioCtx();
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 500;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.6);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
      vaguesNodeRef.current = { noise, gain };
    } catch {
      /* audio indisponible : on ignore */
    }
  }, [arreterVagues, getAudioCtx]);

  const sonEchouage = useCallback(() => {
    try {
      const ctx = getAudioCtx();
      const duree = 0.6;
      const bufferSize = ctx.sampleRate * duree;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1400;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duree);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
      noise.stop(ctx.currentTime + duree);
    } catch {
      /* ignore */
    }
  }, [getAudioCtx]);

  const sonFrottement = useCallback(
    (duree: number) => {
      try {
        const ctx = getAudioCtx();
        const bufferSize = ctx.sampleRate * duree;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 2200;
        filter.Q.value = 0.8;
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0.001, now);
        for (let t = 0; t < duree; t += 0.18) {
          gain.gain.linearRampToValueAtTime(0.12, now + t + 0.06);
          gain.gain.linearRampToValueAtTime(0.02, now + t + 0.16);
        }
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + duree);
      } catch {
        /* ignore */
      }
    },
    [getAudioCtx]
  );

  const sonBouchon = useCallback(() => {
    try {
      const ctx = getAudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);

      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
    } catch {
      /* ignore */
    }
  }, [getAudioCtx]);

  // ---- Persistance du profil (uniquement "consultante", jamais "nada") ----
  // ---- Persistance du profil (uniquement "consultante", jamais "nada") ----
  const [profil, setProfil] = useState<Profil>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("chogan_profil");
    if (saved === "consultante") return "consultante";
    if (saved === "nada") localStorage.removeItem("chogan_profil");
    return null;
  });

  const choisirProfil = (p: "nada" | "consultante", depuisSauvegarde = false) => {
    setProfil(p);
    setTab("write");
    localStorage.setItem("chogan_profil", p);
    if (!depuisSauvegarde) {
      showToast(
        p === "nada" ? "💎 Espace Nada activé" : "🌸 Espace Consultante activé",
        "success"
      );
    }
  };

  const changerProfil = () => {
    localStorage.removeItem("chogan_profil");
    window.location.reload();
  };

  const ouvrirModaleNada = () => {
    setNadaPasswordInput("");
    setModalNadaOpen(true);
  };

  const validerMotDePasseNada = () => {
    if (nadaPasswordInput === NADA_PASSWORD) {
      setModalNadaOpen(false);
      choisirProfil("nada");
    } else {
      showToast("❌ Mot de passe incorrect.", "error");
    }
  };

  // ---- Scellement ----
  const scellerFormulaire = () => {
    if (!prenom.trim() || !nom.trim() || !engagements.trim()) {
      showToast("❌ Veuillez remplir tous les champs du formulaire.", "error");
      return;
    }
    if (!isPinValide(keyConsultante)) {
      showToast("❌ Votre code PIN doit contenir 4 à 8 chiffres.", "error");
      return;
    }

    const data: EngagementData = {
      prenom: prenom.trim(),
      nom: nom.trim(),
      engagements: engagements.trim(),
      timestamp: Date.now(),
    };
    const encrypted = sceller(data, keyConsultante);
    const nomFichier = `engagements_${data.prenom}_${data.nom}.txt`;
    setFallbackText(encrypted);

    try {
      const blob = new Blob([encrypted], { type: "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = nomFichier;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      /* téléchargement non supporté */
    }

    setDownloadedFilename(nomFichier);
    setSealed(true);
    showToast("🔒 Enveloppe scellée avec succès.", "success");
  };

  const reinitialiserFormulaire = () => {
    setPrenom("");
    setNom("");
    setEngagements("");
    setKeyConsultante("");
    setSealed(false);
  };

  // ---- Lecture / ouverture ----
  const chargerFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = (ev) => {
      setPayload((ev.target?.result as string) || "");
      showToast("📁 Fichier chargé.", "success");
    };
    lecteur.readAsText(fichier);
  };

  const demarrerCompteARebours = useCallback((cibleTimestamp: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    const tick = () => {
      const restant = cibleTimestamp - Date.now();
      if (restant <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        setCountdownText(null);
        setStatusMessage({ kind: "success", text: "✅ Le délai est écoulé ! Vous pouvez ouvrir maintenant." });
        return;
      }
      const minutes = Math.floor(restant / 60000);
      const secondes = Math.floor((restant % 60000) / 1000);
      setCountdownText(`⏳ Temps restant : ${minutes}m ${String(secondes).padStart(2, "0")}s`);
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  }, []);

  const lancerAnimationOuvertureFullscreen = useCallback(
    (data: EngagementData, modeAdmin: boolean) => {
      const badge = modeAdmin ? " 🛡️" : "";
      setFsData({
        prenom: data.prenom,
        nom: data.nom,
        titre: `📄 Objectifs de ${data.prenom} ${data.nom}${badge}`,
        date: `Scellé le : ${new Date(data.timestamp).toLocaleString("fr-FR")}`,
        texte: data.engagements,
      });
      setFsShowFinal(false);
      setFsOpen(true);
      document.body.style.overflow = "hidden";
      demarrerVagues();

      if (fsFloatTimer.current) clearTimeout(fsFloatTimer.current);
      fsFloatTimer.current = setTimeout(() => {
        sonEchouage();
        setTimeout(() => sonFrottement(1.3), 400);
        setTimeout(() => {
          setTimeout(() => {
            sonBouchon();
            arreterVagues();
            setTimeout(() => setFsShowFinal(true), 350);
          }, 2000);
        }, 1900);
      }, 3500);
    },
    [demarrerVagues, sonEchouage, sonFrottement, sonBouchon, arreterVagues]
  );

  const ouvrirEnveloppe = () => {
    setStatusMessage(null);
    setCountdownText(null);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (!payload.trim()) {
      showToast("❌ Chargez le fichier ou collez le texte à l'Option B.", "error");
      return;
    }
    if (!decryptKeyConsultante || !decryptKeyNada) {
      showToast("❌ Saisissez les deux codes PIN.", "error");
      return;
    }

    const modeAdmin = estAdmin(decryptKeyNada);
    const data = dechiffrer(payload.trim(), decryptKeyConsultante, decryptKeyNada);

    if (!data) {
      setStatusMessage({
        kind: "error",
        text: modeAdmin
          ? "❌ Impossible de déchiffrer. Vérifiez le PIN de la consultante."
          : "❌ Codes PIN incorrects ou texte corrompu.",
      });
      return;
    }

    const cible = data.timestamp + DUREE_VERROU_MS;
    if (!modeAdmin && Date.now() < cible) {
      demarrerCompteARebours(cible);
      return;
    }

    showToast(
      modeAdmin ? "🛡️ Ouverture forcée par Admin" : "✅ Enveloppe ouverte.",
      modeAdmin ? "info" : "success"
    );
    lancerAnimationOuvertureFullscreen(data, modeAdmin);
  };

  const fermerAnimationFullscreen = () => {
    if (fsFloatTimer.current) clearTimeout(fsFloatTimer.current);
    arreterVagues();
    setFsOpen(false);
    setFsShowFinal(false);
    document.body.style.overflow = "";
  };

  const quitterApp = () => {
    fermerAnimationFullscreen();
    changerProfil();
  };

  // ---- Vue finale : texte / pdf / partage ----
  const texteCompletFinal = () => {
    if (!fsData) return "";
    return `${fsData.titre}\n${fsData.date}\n\n${fsData.texte}`;
  };

  const enregistrerTxt = () => {
    const blob = new Blob([texteCompletFinal()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mes-engagements.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("💾 Fichier enregistré.", "success");
  };

  const enregistrerPDF = () => {
    if (!fsData) return;
    try {
      const doc = new jsPDF();
      const titreClean = fsData.titre.replace(/^📄\s*/, "").replace(/🛡️/g, "");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(titreClean, 15, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(fsData.date, 15, 28);
      doc.setDrawColor(200);
      doc.line(15, 32, 195, 32);
      doc.setFontSize(12);
      doc.setTextColor(30);
      const lignes = doc.splitTextToSize(fsData.texte, 175);
      doc.text(lignes, 15, 44);
      doc.save("mes-engagements.pdf");
      showToast("📄 PDF enregistré.", "success");
    } catch {
      showToast("❌ Impossible de générer le PDF sur cet appareil.", "error");
    }
  };

  const partager = async () => {
    const contenu = texteCompletFinal();
    if (navigator.share) {
      try {
        await navigator.share({ title: fsData?.titre, text: contenu });
      } catch {
        /* partage annulé */
      }
    } else {
      try {
        await navigator.clipboard.writeText(contenu);
        showToast("📋 Texte copié dans le presse-papiers.", "success");
      } catch {
        showToast("❌ Le partage direct n'est pas disponible ici.", "error");
      }
    }
  };

  const engagementLignes = fsData
    ? fsData.texte
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];

  const dureeLisible = (() => {
    const s = Math.round(DUREE_VERROU_MS / 1000);
    if (s < 60) return `${s} secondes`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} minutes`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} heures`;
    return `${Math.round(h / 24)} jours`;
  })();

  // ============================================================
  // RENDU
  // ============================================================

  if (!profil) {
    return (
      <RoleScreen
        onNada={ouvrirModaleNada}
        onConsultante={() => choisirProfil("consultante")}
        modalOpen={modalNadaOpen}
        onCloseModal={() => setModalNadaOpen(false)}
        password={nadaPasswordInput}
        setPassword={setNadaPasswordInput}
        onValider={validerMotDePasseNada}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white text-stone-800 px-4 py-6 max-w-md mx-auto">
      <header className="text-center mb-5">
        <h1 className="text-xl font-bold text-rose-800">🌸 Mes Engagements — Chogan</h1>
        <p className="text-xs text-stone-500 mt-1">
          {profil === "nada" ? "Espace Nada (Formatrice)" : "Espace Consultante"}
        </p>
      </header>

      {/* Stepper */}
      <div className="flex rounded-full bg-rose-100 p-1 mb-5">
        <button
          onClick={() => setTab("write")}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
            tab === "write" ? "bg-rose-600 text-white shadow" : "text-rose-700"
          }`}
        >
          {profil === "nada" ? "1. Écrire (test)" : "1. Écrire"}
        </button>
        <button
          onClick={() => setTab("read")}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
            tab === "read" ? "bg-rose-600 text-white shadow" : "text-rose-700"
          }`}
        >
          {profil === "nada" ? "2. Coaching J+30" : "2. Coaching J+30"}
        </button>
      </div>

      {tab === "write" && (
        <WriteSection
          prenom={prenom}
          nom={nom}
          engagements={engagements}
          keyConsultante={keyConsultante}
          setPrenom={setPrenom}
          setNom={setNom}
          setEngagements={setEngagements}
          setKeyConsultante={setKeyConsultante}
          sealed={sealed}
          downloadedFilename={downloadedFilename}
          fallbackText={fallbackText}
          onSceller={scellerFormulaire}
          onReset={reinitialiserFormulaire}
          onCopy={(text) => {
            navigator.clipboard.writeText(text);
            showToast("📋 Copié.", "success");
          }}
        />
      )}

      {tab === "read" && (
        <ReadSection
          onFileChange={chargerFichier}
          payload={payload}
          setPayload={setPayload}
          decryptKeyConsultante={decryptKeyConsultante}
          setDecryptKeyConsultante={setDecryptKeyConsultante}
          decryptKeyNada={decryptKeyNada}
          setDecryptKeyNada={setDecryptKeyNada}
          onOuvrir={ouvrirEnveloppe}
          statusMessage={statusMessage}
          countdownText={countdownText}
          dureeLisible={dureeLisible}
        />
      )}

      <button
        onClick={changerProfil}
        className="block mx-auto mt-6 text-xs text-stone-500 underline"
      >
        Changer de profil
      </button>

      {/* Toasts */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[3000] w-[90%] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-lg text-sm text-white text-center shadow-lg ${
              t.kind === "success"
                ? "bg-emerald-600"
                : t.kind === "error"
                ? "bg-red-600"
                : "bg-sky-600"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Overlay plein écran bouteille */}
      {fsOpen && (
        <BottleOverlay
          showFinal={fsShowFinal}
          fsData={fsData}
          engagementLignes={engagementLignes}
          onClose={fermerAnimationFullscreen}
          onSavePdf={enregistrerPDF}
          onSaveTxt={enregistrerTxt}
          onShare={partager}
          onQuit={quitterApp}
        />
      )}
    </div>
  );
}

// ============================================================
// SOUS-COMPOSANTS
// ============================================================

function RoleScreen({
  onNada,
  onConsultante,
  modalOpen,
  onCloseModal,
  password,
  setPassword,
  onValider,
}: {
  onNada: () => void;
  onConsultante: () => void;
  modalOpen: boolean;
  onCloseModal: () => void;
  password: string;
  setPassword: (v: string) => void;
  onValider: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-rose-800">🌸 Mes Engagements</h1>
          <p className="text-sm text-stone-500 mt-1">Chogan · Équipe Marie</p>
        </div>

        <button
          onClick={onConsultante}
          className="w-full text-left bg-white border-2 border-rose-200 rounded-2xl p-4 mb-4 shadow-sm hover:border-rose-400 transition"
        >
          <span className="text-2xl block mb-1">💄</span>
          <span className="font-semibold text-rose-800 block">Je suis Consultante</span>
          <span className="text-xs text-stone-500">
            Rédiger mes engagements et les sceller avec mon propre code PIN.
          </span>
        </button>

        <button
          onClick={onNada}
          className="w-full text-left bg-white border-2 border-rose-200 rounded-2xl p-4 shadow-sm hover:border-rose-400 transition"
        >
          <span className="text-2xl block mb-1">💎</span>
          <span className="font-semibold text-rose-800 block">Je suis Nada (Formatrice)</span>
          <span className="text-xs text-stone-500">Accès protégé par mot de passe.</span>
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[3000] px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs">
            <h2 className="font-bold text-rose-800 mb-1">🔐 Espace Formatrice</h2>
            <p className="text-xs text-stone-500 mb-4">
              Cet espace est réservé à Nada. Entrez le mot de passe pour continuer.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 mb-4 text-sm"
              onKeyDown={(e) => e.key === "Enter" && onValider()}
            />
            <div className="flex gap-2">
              <button
                onClick={onCloseModal}
                className="flex-1 py-2 rounded-lg bg-stone-100 text-stone-600 text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={onValider}
                className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WriteSection({
  prenom,
  nom,
  engagements,
  keyConsultante,
  setPrenom,
  setNom,
  setEngagements,
  setKeyConsultante,
  sealed,
  downloadedFilename,
  fallbackText,
  onSceller,
  onReset,
  onCopy,
}: {
  prenom: string;
  nom: string;
  engagements: string;
  keyConsultante: string;
  setPrenom: (v: string) => void;
  setNom: (v: string) => void;
  setEngagements: (v: string) => void;
  setKeyConsultante: (v: string) => void;
  sealed: boolean;
  downloadedFilename: string;
  fallbackText: string;
  onSceller: () => void;
  onReset: () => void;
  onCopy: (text: string) => void;
}) {
  if (sealed) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
        <h3 className="font-bold text-emerald-800 mb-2">C&apos;est scellé ! 🔒</h3>
        <p className="text-sm text-stone-600 mb-3">
          Le fichier <b>{downloadedFilename}</b> a été téléchargé. Gardez-le précieusement
          jusqu&apos;au jour du coaching avec Nada.
        </p>
        <div className="bg-white border border-emerald-200 rounded-lg p-2 mb-3">
          <textarea
            readOnly
            value={fallbackText}
            className="w-full text-[10px] font-mono text-stone-500 h-16 resize-none"
          />
          <button
            onClick={() => onCopy(fallbackText)}
            className="text-xs text-emerald-700 underline mt-1"
          >
            📋 Copier le texte de secours
          </button>
        </div>
        <button
          onClick={onReset}
          className="text-sm text-rose-700 underline"
        >
          Rédiger un autre formulaire
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-stone-700">Prénom</label>
        <input
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-stone-700">Nom</label>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-stone-700">
          Mes engagements pour les 30 prochains jours
        </label>
        <textarea
          value={engagements}
          onChange={(e) => setEngagements(e.target.value)}
          rows={6}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-stone-700">
          Mon code PIN (4 à 8 chiffres)
        </label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={keyConsultante}
          onChange={(e) => setKeyConsultante(e.target.value)}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1"
        />
        <p className="text-xs text-stone-400 mt-1">
          Ce code vous sera redemandé le jour du coaching, avec le code de Nada.
        </p>
      </div>
      <button
        onClick={onSceller}
        className="w-full bg-rose-600 text-white font-bold rounded-full py-3 shadow-lg"
      >
        🔒 Sceller mes engagements
      </button>
    </div>
  );
}

function ReadSection({
  onFileChange,
  payload,
  setPayload,
  decryptKeyConsultante,
  setDecryptKeyConsultante,
  decryptKeyNada,
  setDecryptKeyNada,
  onOuvrir,
  statusMessage,
  countdownText,
  dureeLisible,
}: {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  payload: string;
  setPayload: (v: string) => void;
  decryptKeyConsultante: string;
  setDecryptKeyConsultante: (v: string) => void;
  decryptKeyNada: string;
  setDecryptKeyNada: (v: string) => void;
  onOuvrir: () => void;
  statusMessage: { kind: "error" | "success"; text: string } | null;
  countdownText: string | null;
  dureeLisible: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-stone-700 block mb-1">
          📁 Option A : Charger le fichier .txt
        </label>
        <input type="file" accept=".txt" onChange={onFileChange} className="text-sm" />
      </div>
      <div className="text-center text-xs text-stone-400">— OU —</div>
      <div>
        <label className="text-sm font-semibold text-stone-700">
          📝 Option B : Coller le texte de l&apos;enveloppe
        </label>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={4}
          placeholder="Ouvrez le fichier de la consultante, copiez son contenu et collez-le ici..."
          className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1 text-xs font-mono"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-stone-700">Code Consultante</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={decryptKeyConsultante}
            onChange={(e) => setDecryptKeyConsultante(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-700">Code Nada</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={decryptKeyNada}
            onChange={(e) => setDecryptKeyNada(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 mt-1"
          />
        </div>
      </div>
      <p className="text-xs text-stone-400 text-center">
        🔒 Durée du verrou configurée : {dureeLisible}
      </p>
      <button
        onClick={onOuvrir}
        className="w-full bg-rose-600 text-white font-bold rounded-full py-3 shadow-lg"
      >
        🔓 Ouvrir la lettre d&apos;engagements
      </button>

      {countdownText && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm text-center rounded-lg p-3">
          {countdownText}
        </div>
      )}
      {statusMessage && (
        <div
          className={`text-sm text-center rounded-lg p-3 border ${
            statusMessage.kind === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}
        >
          {statusMessage.text}
        </div>
      )}
    </div>
  );
}

function BottleOverlay({
  showFinal,
  fsData,
  engagementLignes,
  onClose,
  onSavePdf,
  onSaveTxt,
  onShare,
  onQuit,
}: {
  showFinal: boolean;
  fsData: { prenom: string; nom: string; titre: string; date: string; texte: string } | null;
  engagementLignes: string[];
  onClose: () => void;
  onSavePdf: () => void;
  onSaveTxt: () => void;
  onShare: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[2000] bg-[#04243f] overflow-hidden">
      {!showFinal && (
        <>
          <video
            src="/bouteille-mer.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(3,20,40,0.25) 0%, rgba(3,20,40,0.15) 40%, rgba(3,20,40,0.55) 100%)",
            }}
          />
        </>
      )}

      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/25 text-white font-bold"
      >
        ✕
      </button>

      {showFinal && fsData && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-stone-50 to-stone-200 px-6 py-8 text-center">
          <div className="max-w-md w-full max-h-[55vh] overflow-y-auto">
            <h2 className="text-emerald-800 font-bold text-lg mb-1">{fsData.titre}</h2>
            <p className="text-stone-500 text-xs mb-5">{fsData.date}</p>
            {engagementLignes.length > 1 ? (
              <ul className="flex flex-col gap-2 text-left">
                {engagementLignes.map((l, i) => (
                  <li
                    key={i}
                    className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-stone-800 text-sm"
                  >
                    {l}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bg-white rounded-xl p-5 shadow text-stone-800 text-left whitespace-pre-wrap">
                {fsData.texte}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs mt-6">
            <button onClick={onSavePdf} className="bg-rose-600 text-white rounded-full py-3 font-bold">
              📄 Enregistrer en PDF
            </button>
            <button onClick={onSaveTxt} className="bg-rose-600 text-white rounded-full py-3 font-bold">
              💾 Enregistrer (.txt)
            </button>
            <button onClick={onShare} className="bg-rose-600 text-white rounded-full py-3 font-bold">
              📤 Transférer
            </button>
            <button onClick={onQuit} className="bg-stone-500 text-white rounded-full py-3 font-bold">
              ⬅️ Retour
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
