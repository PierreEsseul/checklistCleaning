let currentStep = 0;

const steps = document.querySelectorAll('.step');
const form = document.getElementById('cleaning-form');
const resultBox = document.getElementById('form-result');

const progressFill = document.getElementById('progressFill');
const stepIndicator = document.getElementById('stepIndicator');

const STORAGE_KEY = 'cc_cleaning_form_state_v3';

const heuresInput = document.getElementById('heures_travail');
const depSuperInput = document.getElementById('depenses_supermarche');
const depLaverieInput = document.getElementById('depenses_laverie');
const montantMenageSpan = document.getElementById('montant_menage');
const montantTotalSpan = document.getElementById('montant_total');

const TAUX_HORAIRE = 15; // 15 €/h

// "Base de données" chargée depuis apartments.json
let apartmentConfigs = {};

// --- Navigation entre les étapes ---

function showStep(index) {
  steps.forEach((step, i) => {
    step.classList.toggle('active', i === index);
  });

  // Mise à jour de la barre de progression
  const totalSteps = steps.length;
  if (progressFill) {
    const percent = (index / (totalSteps - 1)) * 100;
    progressFill.style.width = percent + '%';
  }

  // Texte "Étape X / Y"
  if (stepIndicator) {
    stepIndicator.textContent = `Étape ${index + 1} / ${totalSteps}`;
  }
}


function nextStep() {
  if (currentStep < steps.length - 1) {
    currentStep++;
    showStep(currentStep);
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    showStep(currentStep);
  }
}

// --- Calcul des montants ---

function formatEuro(value) {
  const n = Number.isFinite(value) ? value : 0;
  return n.toFixed(2).replace('.', ',') + ' €';
}

function updateAmounts() {
  const heures = parseFloat(heuresInput?.value || '0') || 0;
  const depSuper = parseFloat(depSuperInput?.value || '0') || 0;
  const depLaverie = parseFloat(depLaverieInput?.value || '0') || 0;

  const montantMenage = heures * TAUX_HORAIRE;
  const total = montantMenage + depSuper + depLaverie;

  if (montantMenageSpan) {
    montantMenageSpan.textContent = formatEuro(montantMenage);
  }
  if (montantTotalSpan) {
    montantTotalSpan.textContent = formatEuro(total);
  }
}

// --- LocalStorage : sauvegarde & restauration ---

function saveState() {
  const data = {};
  Array.from(form.elements).forEach(el => {
    if (!el.name) return;
  if (el.type === 'checkbox') {   data[el.name] = el.checked;
  } else {
   data[el.name] = el.value;
  }
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    Array.from(form.elements).forEach(el => {
      if (!el.name) return;
      if (!(el.name in data)) return;
      if (el.type === 'checkbox') {
        el.checked = !!data[el.name];
      } else {
        el.value = data[el.name];
      }
    });
  } catch (e) {
    console.error('Erreur de parsing localStorage', e);
  }
}

// --- Appliquer la config d'un appartement ---

function applyApartmentConfig(code) {
  const notesBox = document.getElementById('apt-notes');
  if (!notesBox) return;

  const config = apartmentConfigs[code];

  // D'abord, tout réafficher par défaut
  document.querySelectorAll(
    '.option-dishwasher, .option-plants, .option-sofabed, .option-oven, .option-microwave, .option-coffee'
  ).forEach(el => {
    el.style.display = 'block';
  });

  // Si pas de config (AUTRE ou rien sélectionné)
  if (!config) {
    notesBox.innerHTML = '';
    return;
  }

  // Bloc notes / capacité
  let html = `<strong>Spécificités pour ${config.nom || code} :</strong>`;

  if (Array.isArray(config.notes) && config.notes.length > 0) {
    html += '<ul>';
    config.notes.forEach(n => {
      html += `<li>${n}</li>`;
    });
    html += '</ul>';
  }

  if (config.maxGuests) {
    html += `<p>Capacité habituelle : <strong>${config.maxGuests} personnes</strong>.</p>`;
  }

  notesBox.innerHTML = html;

  const eq = config.equipment || {};
  const linens = config.linens || {};

  // --------- LAVE-VAISSELLE ----------
  const dwLabel = document.querySelector('.option-dishwasher');
  if (dwLabel) {
    dwLabel.style.display = eq.hasDishwasher ? 'block' : 'none';
  }

  // --------- FOUR ----------
  const ovenLabel = document.querySelector('.option-oven');
  if (ovenLabel) {
    ovenLabel.style.display = eq.hasOven ? 'block' : 'none';
  }

  // --------- MICRO-ONDES ----------
  const microLabel = document.querySelector('.option-microwave');
  if (microLabel) {
    microLabel.style.display = eq.hasMicrowave ? 'block' : 'none';
  }

  // --------- PLANTES (case déjà en .option-plants sur l’étape Arrivée) ----------
  const plantsLabel = document.querySelector('.option-plants');
  if (plantsLabel) {
    plantsLabel.style.display = eq.hasPlants ? 'block' : 'none';
  }

  // --------- CANAPÉ-LIT (étape Chambres & lits) ----------
  const sofaLabel = document.querySelector('.option-sofabed');
  if (sofaLabel) {
    sofaLabel.style.display = linens.hasSofaBed ? 'block' : 'none';
  }

  // --------- CAFETIÈRE ----------
  const coffeeLabelWrapper = document.querySelector('.option-coffee');
  const coffeeTextSpan = document.getElementById('label_cafetiere_text');

  if (coffeeLabelWrapper) {
    if (eq.hasCoffeeMachine) {
      coffeeLabelWrapper.style.display = 'block';

      if (coffeeTextSpan) {
        const type = (eq.coffeeType || '').toLowerCase();

        if (type.includes('nespresso') || type.includes('capsule')) {
          coffeeTextSpan.textContent =
            "Vider la cafetière à capsules, jeter les capsules usagées, nettoyer la machine et vider le réservoir d'eau.";
        } else if (type.includes('filtre')) {
          coffeeTextSpan.textContent =
            "Vider la cafetière à filtre, jeter le filtre usagé, nettoyer la verseuse et la machine.";
        } else {
          coffeeTextSpan.textContent =
            "Vider la cafetière, nettoyer la machine et vider le réservoir d'eau.";
        }
      }
    } else {
      // Pas de cafetière dans cet appart → on cache la ligne
      coffeeLabelWrapper.style.display = 'none';
    }
  }
}
// --- Init ---

document.addEventListener('DOMContentLoaded', function() {
  // Init EmailJS v4 (mets ta clé publique)
  if (window.emailjs) {
    emailjs.init({
      publicKey: 'YOUR_PUBLIC_KEY', // <-- à remplacer
    });
  }

  // Charger la "base de données" apartments.json
  fetch('apartments.json')
    .then(res => res.json())
    .then(data => {
      apartmentConfigs = data || {};

      // Appliquer config à l'appartement actuellement sélectionné (y compris via localStorage)
      const selectLogement = document.getElementById('logement');
      if (selectLogement) {
        applyApartmentConfig(selectLogement.value);
      }
    })
    .catch(err => {
      console.error('Erreur chargement apartments.json', err);
    });

  loadState();
  updateAmounts();
  showStep(currentStep);

  // Sauvegarde automatique à chaque changement
  Array.from(form.elements).forEach(el => {
    if (!el.name) return;

    const handler = () => {
      if (
        el.id === 'heures_travail' ||
        el.id === 'depenses_supermarche' ||
        el.id === 'depenses_laverie'
      ) {
        updateAmounts();
      }
      saveState();
    };

    if (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'date') {
      el.addEventListener('change', handler);
    } else {
      el.addEventListener('input', handler);
    }
  });

  // Quand on change de logement → appliquer la config
  const selectLogement = document.getElementById('logement');
  if (selectLogement) {
    selectLogement.addEventListener('change', function() {
      applyApartmentConfig(this.value);
      saveState();
    });
  }
});

// --- Submit du formulaire ---

form.addEventListener('submit', function(e) {
  e.preventDefault();

  const formData = new FormData(form);

  const logement = formData.get('logement') || '(non renseigné)';
  const agent = formData.get('agent') || '(non renseigné)';

  const rawDate = formData.get('date') || '';
  let date = '(non renseignée)';
  if (rawDate) {
    const parts = rawDate.split('-'); // YYYY-MM-DD
    if (parts.length === 3) {
      const [year, month, day] = parts;
      date = `${day}/${month}/${year}`;
    } else {
      date = rawDate;
    }
  }

  const commentaires = formData.get('commentaires') || 'Aucun';

  const heures = parseFloat(formData.get('heures_travail') || '0') || 0;
  const depSuper = parseFloat(formData.get('depenses_supermarche') || '0') || 0;
  const depLaverie = parseFloat(formData.get('depenses_laverie') || '0') || 0;

  const montantMenage = heures * TAUX_HORAIRE;
  const totalGlobal = montantMenage + depSuper + depLaverie;

  // Cases cochées / non cochées
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  const total = checkboxes.length;
  let checked = 0;
  const uncheckedLabels = [];

  checkboxes.forEach(cb => {
    if (cb.checked) {
      checked++;
    } else {
      const label = cb.parentElement;
      if (label) {
        const txt = label.textContent.replace(/\s+/g, ' ').trim();
        uncheckedLabels.push(txt);
      }
    }
  });

  let recapTaches;
  if (uncheckedLabels.length === 0) {
    recapTaches = 'Tout est OK : toutes les cases ont été cochées.';
  } else {
    recapTaches =
      'ATTENTION : certaines cases ne sont pas cochées :\n- ' +
      uncheckedLabels.join('\n- ');
  }

  const paiementResume =
    `Heures effectuées : ${heures.toFixed(2)} h\n` +
    `Montant ménage (15 €/h) : ${montantMenage.toFixed(2)} €\n` +
    `Dépenses supermarché : ${depSuper.toFixed(2)} €\n` +
    `Montant laverie : ${depLaverie.toFixed(2)} €\n` +
    `TOTAL : ${totalGlobal.toFixed(2)} €`;

  const recapGlobal = `
Logement : ${logement}
Agent : ${agent}
Date : ${date}

Cases cochées : ${checked} / ${total}

${recapTaches}

---

${paiementResume}

Commentaires :
${commentaires}
  `.trim();

  // Affichage local
  if (resultBox) {
    resultBox.style.display = 'block';
    resultBox.textContent = recapGlobal;
  }

  console.log('Récap ménage :\n', recapGlobal);

  // --- Envoi EmailJS : mets tes IDs et décommente ---

  
  if (window.emailjs) {
    emailjs.send('service_7jwblni', 'template_ycc5377', {
      logement: logement,
      agent: agent,
      date: date,
      recap_taches: recapTaches,
      recapGlobal: recapGlobal,
      paiement_resume: paiementResume,
      heures: heures.toFixed(2),
      montant_menage: montantMenage.toFixed(2),
      depenses_supermarche: depSuper.toFixed(2),
      montant_laverie: depLaverie.toFixed(2),
      total_global: totalGlobal.toFixed(2),
      commentaires: commentaires
    }).then(function() {
      alert('Formulaire envoyé par email avec succès !');
    }, function(error) {
      console.error('Erreur EmailJS :', error);
      alert('Formulaire rempli, mais erreur lors de l’envoi email.');
    });
  } else {
    alert('Formulaire rempli ! Pense à envoyer la vidéo sur WhatsApp.');
  }

  // On nettoie le stockage pour le prochain ménage
  localStorage.removeItem(STORAGE_KEY);
});
