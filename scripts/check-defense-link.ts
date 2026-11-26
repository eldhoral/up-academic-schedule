import assert from 'node:assert/strict'
import { defenseLinkLabel, normalizeDefenseLink } from '../src/app/[prodi]/sidang/defense-types'

// --- normalizeDefenseLink: the field becomes a target=_blank button on a public page, so only http(s) passes --------------
assert.equal(normalizeDefenseLink('  '), '', 'blank means no material yet')
assert.equal(normalizeDefenseLink(''), '')
assert.equal(normalizeDefenseLink('  https://drive.google.com/file/x '), 'https://drive.google.com/file/x', 'surrounding spaces are trimmed')
assert.equal(normalizeDefenseLink('http://drive.google.com/file/x'), 'http://drive.google.com/file/x')
assert.equal(normalizeDefenseLink('javascript:alert(1)'), null, 'javascript: never becomes a link')
assert.equal(normalizeDefenseLink('data:text/html,x'), null, 'data: never becomes a link')
assert.equal(normalizeDefenseLink('drive.google.com/file/x'), null, 'no scheme is not a link — it would open the site itself')

// --- defenseLinkLabel: the button names the defense's material ----------------------
assert.equal(defenseLinkLabel('sidang'), 'Materi Sidang')
assert.equal(defenseLinkLabel('prasidang'), 'Materi Prasidang')

console.log('defense link: all checks passed')
