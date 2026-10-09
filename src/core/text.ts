/** Text folding used by search and by the grading of typed answers. No browser APIs. */

/** Folds Persian/Arabic letter variants and half-spaces so text matches however it was typed. */
export function foldPersian(text: string): string {
  return text
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[‌‍ً-ْ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Lower-cases German and folds umlauts/ß so "strasse", "Straße" and "apfel"/"Äpfel" find each other. */
export function foldGerman(text: string): string {
  return text
    .toLocaleLowerCase('de')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Like foldGerman, and additionally treats the keyboard spellings ae/oe/ue as the umlaut
 * ("Aepfel" = "Äpfel"). Only meaningful for comparing two strings folded the same way.
 */
export function foldGermanLoose(text: string): string {
  return foldGerman(text).replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
}
