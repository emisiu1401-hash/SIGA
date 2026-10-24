"""Teste visual/funcional do protótipo fictício v2.3; sem rede e sem Gmail real.
Requer: python -m pip install playwright; playwright install chromium.
Executar: python tests/test_responsive_browser.py
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'prototype/dashboard_sdg_demo.html').read_text(encoding='utf-8')
WIDTHS=[360,390,768,1024,1366,1920]

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path=os.environ.get('SIGA_CHROMIUM_PATH'), args=['--no-sandbox'])
    for w in WIDTHS:
        page=browser.new_page(viewport={'width':w,'height':800}, device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.set_content(HTML,wait_until='load')
        page.wait_for_selector('#kpis .kpi')
        assert len(page.locator('#kpis .kpi').all())==8,w
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),f'overflow geral em {w}px'
        assert page.locator('#rows tr').count()==20,w
        if w<=760:
            assert page.locator('.mobile-topbar').is_visible(),w
            assert page.locator('#mobileCards .mobile-card').count()==20,w
            assert not page.locator('.table-wrap').is_visible(),w
            assert not page.locator('#filtersPanel').is_visible(),w
            page.get_by_role('button',name='Filtros').click()
            assert page.locator('#filtersPanel').is_visible(),w
            page.locator('#department').select_option('SLC')
            page.locator('#person').select_option('Ana')
            assert page.locator('#mobileCards .mobile-card').count()==3,w
            assert 'Ana' in page.locator('#mobileCards').inner_text(),w
            page.get_by_role('button',name='Abrir menu de navegação').click()
            assert page.locator('#sidebar').evaluate('(el)=>el.classList.contains("is-open")'),w
            page.keyboard.press('Escape')
            assert not page.locator('#sidebar').evaluate('(el)=>el.classList.contains("is-open")'),w
            page.locator('#mobileCards button[data-id]').first.click()
            assert page.locator('#dialog').evaluate('(el)=>el.classList.contains("show")'),w
            page.get_by_role('button',name='Fechar').click()
            assert not page.locator('#dialog').evaluate('(el)=>el.classList.contains("show")'),w
            page.locator('#clear').click()
            assert page.locator('#mobileCards .mobile-card').count()==20,w
        else:
            assert not page.locator('.mobile-topbar').is_visible(),w
            page.locator('#department').select_option('SLC')
            page.locator('#person').select_option('Ana')
            assert page.locator('#rows tr').count()==3,w
            assert 'Ana' in page.locator('#rows').inner_text(),w
        if w in (390,768,1366):
            evidence=ROOT/'.local'/'prototype-evidence'
            evidence.mkdir(parents=True,exist_ok=True)
            page.screenshot(path=str(evidence/f'dashboard_{w}px_v23.png'),full_page=True)
        assert not errors,f'Erros JS em {w}: {errors}'
        print(f'OK responsivo: {w}px; filtros, cards/tabela e integridade JS')
        page.close()
    browser.close()
print('PASSOU: 6 viewports, integração visual offline e sem rolagem horizontal da página.')
