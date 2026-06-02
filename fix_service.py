import re

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/services/vacantes.service.js', 'r') as f:
    content = f.read()

# Remove the incorrectly appended string
content = content.split('  static async searchTorreCaballito(query) {')[0]

# Add it properly into the object
content = content.replace(
    '''    getTorreCaballitoEmpleados: (piso, ua, options = {}) => {
        return apiFetch(`/plantilla/torre-caballito/empleados/?piso=${encodeURIComponent(piso)}&ua=${encodeURIComponent(ua)}`, {
            method: 'GET',
            ...options
        });
    }
};''',
    '''    getTorreCaballitoEmpleados: (piso, ua, options = {}) => {
        return apiFetch(`/plantilla/torre-caballito/empleados/?piso=${encodeURIComponent(piso)}&ua=${encodeURIComponent(ua)}`, {
            method: 'GET',
            ...options
        });
    },
    searchTorreCaballito: (query, options = {}) => {
        return apiFetch(`/plantilla/torre-caballito/search/?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            ...options
        });
    }
};'''
)

with open('/home/edgar/ANAM/EjeCentral/eje_central_front/src/services/vacantes.service.js', 'w') as f:
    f.write(content)
