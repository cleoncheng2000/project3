// Remembers the last name you used so you don't retype it for every trip.
export function getSavedName() {
  try {
    return localStorage.getItem('displayName') || ''
  } catch {
    return ''
  }
}

export function saveName(name) {
  try {
    localStorage.setItem('displayName', name)
  } catch {
    // ignore (private browsing etc.)
  }
}
