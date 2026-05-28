async function getConfigValues(db, keys, defaults = []) {
  try {
    const res = await db.collection('system_config')
      .where({ config_key: db.command.in(keys) })
      .get()
    const valueMap = {}
    for (const doc of (res.data || [])) {
      valueMap[doc.config_key] = doc.config_value
    }
    return keys.map((key, index) => (
      valueMap[key] !== undefined ? valueMap[key] : defaults[index]
    ))
  } catch (error) {
    return defaults
  }
}

async function getConfigValue(db, key, defaultValue) {
  const [value] = await getConfigValues(db, [key], [defaultValue])
  return value
}

function createCachedConfigValue(db, ttl) {
  if (ttl === undefined) ttl = 30000
  const cache = new Map()

  return async function getCachedConfigValue(key, defaultValue) {
    const now = Date.now()
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now) {
      return cached.value
    }

    try {
      const res = await db.collection('system_config')
        .where({ config_key: key })
        .limit(1)
        .get()
      const value = res.data.length > 0 ? res.data[0].config_value : defaultValue
      cache.set(key, { value, expiresAt: now + ttl })
      return value
    } catch (e) {
      return defaultValue
    }
  }
}

module.exports = {
  getConfigValue,
  getConfigValues,
  createCachedConfigValue
}
