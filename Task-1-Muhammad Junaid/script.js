const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.primary-nav');
const navLinks = navigation.querySelectorAll('a');
const filterButtons = document.querySelectorAll('[data-filter]');
const projectCards = document.querySelectorAll('[data-category]');
const filterStatus = document.querySelector('[data-filter-status]');
const saveButtons = document.querySelectorAll('[data-save]');
const savedCount = document.querySelector('[data-saved-count]');
const form = document.querySelector('[data-contact-form]');
const formStatus = document.querySelector('[data-form-status]');

const setMenu = (isOpen) => {
  menuButton.setAttribute('aria-expanded', String(isOpen));
  navigation.classList.toggle('is-open', isOpen);
  document.body.classList.toggle('menu-open', isOpen);
};

menuButton.addEventListener('click', () => {
  setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
});

navLinks.forEach((link) => link.addEventListener('click', () => setMenu(false)));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuButton.focus();
  }
});

const updateHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 48);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    let visibleCount = 0;

    filterButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });

    projectCards.forEach((card) => {
      const visible = filter === 'all' || card.dataset.category === filter;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    filterStatus.textContent = `${visibleCount} ${visibleCount === 1 ? 'project' : 'projects'} shown.`;
  });
});

let savedProjects = [];
try {
  savedProjects = JSON.parse(localStorage.getItem('atelier-form-saved')) || [];
} catch {
  savedProjects = [];
}

const renderSavedProjects = () => {
  savedCount.textContent = savedProjects.length;
  saveButtons.forEach((button) => {
    const isSaved = savedProjects.includes(button.dataset.save);
    button.setAttribute('aria-pressed', String(isSaved));
    button.setAttribute('aria-label', `${isSaved ? 'Remove' : 'Save'} ${button.closest('article').querySelector('h3').textContent}`);
  });
};

saveButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const project = button.dataset.save;
    savedProjects = savedProjects.includes(project)
      ? savedProjects.filter((item) => item !== project)
      : [...savedProjects, project];
    localStorage.setItem('atelier-form-saved', JSON.stringify(savedProjects));
    renderSavedProjects();
  });
});

renderSavedProjects();

const validationMessages = {
  name: 'Please tell us your name.',
  email: 'Please enter a valid email address.',
  'project-type': 'Please choose a project type.',
  message: 'Please share a few details about your project.'
};

const validateField = (field) => {
  const valid = field.checkValidity();
  field.setAttribute('aria-invalid', String(!valid));
  const error = form.querySelector(`[data-error-for="${field.name}"]`);
  error.textContent = valid ? '' : validationMessages[field.name];
  return valid;
};

form.querySelectorAll('input, select, textarea').forEach((field) => {
  field.addEventListener('blur', () => validateField(field));
  field.addEventListener('input', () => {
    if (field.getAttribute('aria-invalid') === 'true') validateField(field);
  });
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const fields = [...form.querySelectorAll('input, select, textarea')];
  const valid = fields.map(validateField).every(Boolean);

  if (!valid) {
    formStatus.textContent = 'Please review the highlighted fields.';
    fields.find((field) => !field.checkValidity()).focus();
    return;
  }

  formStatus.textContent = `Thank you, ${form.elements.name.value}. Your project note is ready to send.`;
  form.reset();
  fields.forEach((field) => field.removeAttribute('aria-invalid'));
});

document.querySelector('[data-year]').textContent = new Date().getFullYear();
