// Navigation shared by the non-race pages. No game state is changed here.
(() => {
  const sidebar = document.getElementById('sidebar');
  const mobile = matchMedia('(max-width: 1100px)');
  if (sidebar) {
    const toggle = document.createElement('button');
    toggle.className = 'mobile-menu-toggle';
    toggle.type = 'button';
    toggle.textContent = document.body.dataset.page === 'builder' ? '☰ Ferramentas' : '☰ Menu';
    toggle.setAttribute('aria-controls', 'sidebar');
    toggle.setAttribute('aria-expanded', 'false');
    const backdrop = document.createElement('button');
    backdrop.className = 'mobile-menu-backdrop';
    backdrop.setAttribute('aria-label', 'Fechar menu');
    backdrop.tabIndex = -1;
    const setOpen = (open) => {
      document.body.classList.toggle('mobile-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      sidebar.inert = mobile.matches && !open;
    };
    toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('mobile-menu-open')));
    backdrop.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('mobile-menu-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    sidebar.addEventListener('click', (event) => {
      if (document.body.dataset.page !== 'builder' && event.target.closest('.nav button, .profile-top, a')) setOpen(false);
    });
    mobile.addEventListener('change', () => setOpen(false));
    document.body.append(backdrop, toggle);
    setOpen(false);
  }
  if (['builder', 'hub'].includes(document.body.dataset.page)) {
    const notice = document.createElement('div');
    notice.className = 'orientation-notice';
    notice.setAttribute('role', 'dialog');
    notice.setAttribute('aria-label', 'Vire o celular');
    notice.innerHTML = '<span class="rotate-icon" aria-hidden="true">↻ ▭</span><h2>Vire o celular</h2><p>Use esta tela com o celular de lado para ter espaço para jogar e usar os controles.</p><a href="index.html">Voltar ao lobby</a>';
    document.body.append(notice);
  }
})();
