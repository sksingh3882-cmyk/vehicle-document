(function () {
  const BANNER_SRC = '/banner.png';

  function addStyles() {
    if (document.getElementById('topBannerStyles')) return;
    const style = document.createElement('style');
    style.id = 'topBannerStyles';
    style.textContent = `
      .topAppBannerWrap {
        width: 100%;
        max-width: 1100px;
        margin: 8px auto 12px;
        padding: 0 8px;
      }
      .topAppBanner {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 18px;
        border: 1px solid #dbeafe;
        box-shadow: 0 10px 28px rgba(37, 99, 235, 0.12);
        background: #fff;
      }
      @media (max-width: 768px) {
        .topAppBannerWrap {
          margin: 6px auto 10px;
          padding: 0 6px;
        }
        .topAppBanner {
          border-radius: 14px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function insertBanner() {
    if (document.getElementById('topAppBannerWrap')) return true;
    const container = document.querySelector('.upPage') || document.querySelector('.page');
    if (!container) return false;

    addStyles();
    const wrap = document.createElement('div');
    wrap.id = 'topAppBannerWrap';
    wrap.className = 'topAppBannerWrap';
    wrap.innerHTML = '<img class="topAppBanner" src="' + BANNER_SRC + '" alt="Realtime Vehicle Document Tracking System by Sanjay Singh" />';
    container.insertBefore(wrap, container.firstChild);
    return true;
  }

  const timer = setInterval(() => {
    if (insertBanner()) clearInterval(timer);
  }, 300);
  setTimeout(() => clearInterval(timer), 10000);
})();
