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

// Печать статьи: @page подгоняется под формат/ориентацию статьи (поля = 0,
// т.к. отступы заданы padding'ом на самом листе .theory-preview-content —
// печать получается пиксель-в-пиксель как превью). Стиль временный.
export const printWithPageSize = (pageSettings = DEFAULT_SETTINGS) => {
    const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation)
    const style = document.createElement('style')
    style.setAttribute('data-theory-print', '')
    style.textContent = `@page { size: ${dims.width}mm ${dims.height}mm; margin: 0; }`
    document.head.appendChild(style)
    window.print()
    setTimeout(() => style.remove(), 1000)
}
