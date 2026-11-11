export function pathName(path) {
  return path.split(/[\\/]/).pop()
}

export function isWithinFolder(folderPath, filePath) {
  if (!folderPath || !filePath) return false
  const folder = folderPath.replace(/\\/g, '/').replace(/\/+$/, '')
  return filePath.replace(/\\/g, '/').startsWith(`${folder}/`)
}

export function isSameOrDescendant(parent, path) {
  return path === parent || isWithinFolder(parent, path)
}

export function pathAfterRename(path, { oldPath, newPath }) {
  return isSameOrDescendant(oldPath, path) ? newPath + path.slice(oldPath.length) : path
}

export function renameTreeItem(item, rename) {
  return {
    ...item,
    path: pathAfterRename(item.path, rename),
    name: item.path === rename.oldPath ? rename.newName : item.name,
    ...(item.children && { children: item.children.map((child) => renameTreeItem(child, rename)) })
  }
}

function* filesInTree(items) {
  for (const item of items) {
    if (item.isDirectory) yield* filesInTree(item.children ?? [])
    else if (item.path) yield item.path
  }
}

export function preferredFilePath(tree, rememberedPath) {
  let firstPath
  for (const path of filesInTree(tree)) {
    if (path === rememberedPath || !rememberedPath) return path
    firstPath ??= path
  }
  return firstPath
}
