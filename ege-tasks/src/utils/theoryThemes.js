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
    marginTop: 15,
    marginBottom: 15,
    marginLeft: 15,
    marginRight: 15,
    fontSize: 16
}
