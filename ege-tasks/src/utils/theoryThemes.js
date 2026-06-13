// Размеры страницы по формату и ориентации
export const getPageDimensions = (pageSize, orientation) => {
    const sizes = {
        A4: { width: 210, height: 297 },
        A5: { width: 148, height: 210 }
    }
    const size = sizes[pageSize] || sizes.A4

    if (orientation === 'landscape') {
        return { width: size.height, height: size.width }
    }
    return size
}

export const DEFAULT_SETTINGS = {
    pageSize: 'A4',
    orientation: 'portrait',
    columns: 1,
    marginTop: 12,
    marginBottom: 12,
    marginLeft: 10,
    marginRight: 10,
    fontSize: 16
}

// Печать статьи: поля задаём через @page margin (а не padding'ом листа), чтобы
// браузер резервировал их на КАЖДОЙ странице — иначе со 2-й страницы верхний
// отступ пропадает. Печатный CSS (@media print) при этом снимает собственный
// padding листа, чтобы поля не задвоились. Стиль временный.
export const printWithPageSize = (pageSettings = DEFAULT_SETTINGS) => {
    const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation)
    const mT = pageSettings.marginTop ?? DEFAULT_SETTINGS.marginTop
    const mR = pageSettings.marginRight ?? DEFAULT_SETTINGS.marginRight
    const mB = pageSettings.marginBottom ?? DEFAULT_SETTINGS.marginBottom
    const mL = pageSettings.marginLeft ?? DEFAULT_SETTINGS.marginLeft
    const style = document.createElement('style')
    style.setAttribute('data-theory-print', '')
    style.textContent = `@page { size: ${dims.width}mm ${dims.height}mm; margin: ${mT}mm ${mR}mm ${mB}mm ${mL}mm; }`
    document.head.appendChild(style)
    window.print()
    setTimeout(() => style.remove(), 1000)
}
