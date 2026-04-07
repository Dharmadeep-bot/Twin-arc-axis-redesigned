export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const getShortColumnName = (name) => {
  if (!name) return name
  if (name.includes('_minus_')) {
    const parts = name.split('_minus_')
    return `${getShortColumnName(parts[0])}-${getShortColumnName(parts[1])}`
  }
  const parts = name.split('_')
  if (parts.length > 0) {
    // Return the first part if it's not just a digit and not too long
    if (parts[0].length > 1) return parts[0]
  }
  return name
}

export const getNodeMapping = (name) => {
  if (!name) return { node: '', label: '' }

  const lower = name.toLowerCase()

  // node#8: Oxygen PDI - Slurry PDI (minus case first)
  if (lower.includes('_minus_')) {
    if (lower.includes('oxygenpdi') && lower.includes('slurrypdi'))
      return { node: 'node#8', label: 'Oxygen PDI − Slurry PDI' }
  }

  // node#1: Slurry PDI
  if (lower.includes('slurrypdi')) return { node: 'node#1', label: 'Slurry PDI' }
  // node#2: Oxygen PDI
  if (lower.includes('oxygenpdi')) return { node: 'node#2', label: 'Oxygen PDI' }
  // node#3: Slurry SPM Magnetic Flow
  if (lower.includes('slurryspm') || lower.includes('sy233019'))
    return { node: 'node#3', label: 'Slurry SPM Magnetic Flow' }
  // node#4: 1st Stage Temperature (CTS based)
  if (lower.includes('ctsbased') || lower.includes('ty234703'))
    return { node: 'node#4', label: '1st Stage Temperature (CTS based)' }
  // node#5: Slurry Pressure
  if (lower.includes('slurrypressure') || lower.includes('pi234046'))
    return { node: 'node#5', label: 'Slurry Pressure' }
  // node#6: Oxygen Flow to Mixers
  if (lower.includes('oxygenflow') || (lower.includes('fic234333') && lower.includes('meas')))
    return { node: 'node#6', label: 'Oxygen Flow to Mixers' }
  // node#7: Oxygen Control Valve SP PV
  if (lower.includes('oxygencontrol') || (lower.includes('fic234333') && lower.includes('spt')))
    return { node: 'node#7', label: 'Oxygen Control Valve SP PV' }

  return { node: '-', label: getShortColumnName(name) }
}

export const getBackendConfig = () => {
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return {
      API_HOST: 'http://localhost:5000',
      API_BASE: 'http://localhost:5000/api'
    }
  }
  return {
    API_HOST: 'https://axisapi1.dev.twinarcpro.eminds.ai',
    API_BASE: 'https://axisapi1.dev.twinarcpro.eminds.ai/api'
  }
}
export const getUnitForVariable = (name) => {
  if (!name) return ''
  const n = name.toLowerCase().replace(/[\s_-]/g, '')
  if (n.includes('slurrypdi')) return 'kg/cm²(g)'
  if (n.includes('oxygenpdi')) return 'kg/cm²(g)'
  if (n.includes('slurryspm')) return 'm³/h'
  if (n.includes('ctsbased')) return '°C'
  if (n.includes('slurrypressure')) return 'kg/cm²(g)'
  if (n.includes('oxygenflow')) return 'kg/h'
  if (n.includes('oxygencontrol')) return 'kg/h'
  if (n.includes('oxygenpdislurrypd')) return 'kg/cm²(g)'
  return ''
}
