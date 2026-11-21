// Picks the theme before the page paints, so there is no flash.
// Paper is the default. Night follows the system setting unless the person
// chose a theme by hand (stored in localStorage).
(function () {
  var theme = 'paper';
  try {
    var saved = window.localStorage.getItem('commons.theme');
    if (saved === 'paper' || saved === 'night') {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'night';
    }
  } catch {
    /* storage can be blocked; Paper is fine */
  }
  document.documentElement.setAttribute('data-theme', theme);

  // Classic is the default look; the redesign is opt-in from the You page.
  var design = 'classic';
  try {
    if (window.localStorage.getItem('commons.design') === 'modern') design = 'modern';
  } catch {
    /* storage can be blocked; Classic is fine */
  }
  document.documentElement.setAttribute('data-design', design);
})();
