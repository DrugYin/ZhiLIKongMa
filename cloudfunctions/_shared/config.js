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

module.exports = {
  getConfigValue,
  getConfigValues
}
