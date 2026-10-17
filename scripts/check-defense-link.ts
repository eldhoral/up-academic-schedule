import assert from 'node:assert/strict'
import { defenseLinkLabel, normalizeDefenseLink } from '../src/app/[prodi]/sidang/defense-types'

// --- normalizeDefenseLink: the field becomes a target=_blank button on a public page, so only http(s) passes --------------
assert.equal(normalizeDefenseLink('  '), '', 'blank means no link')
assert.equal(normalizeDefenseLink(''), '')
assert.equal(normalizeDefenseLink('  https://zoom.us/j/123 '), 'https://zoom.us/j/123', 'surrounding spaces are trimmed')
assert.equal(normalizeDefenseLink('http://meet.google.com/abc'), 'http://meet.google.com/abc')
assert.equal(normalizeDefenseLink('javascript:alert(1)'), null, 'javascript: never becomes a link')
assert.equal(normalizeDefenseLink('data:text/html,x'), null, 'data: never becomes a link')
assert.equal(normalizeDefenseLink('zoom.us/j/123'), null, 'no scheme is not a link — it would open the site itself')

// --- defenseLinkLabel: the button says what the room will be at the far end ----------------
assert.equal(defenseLinkLabel('https://zoom.us/j/123'), 'Gabung Zoom')
assert.equal(defenseLinkLabel('https://us02web.zoom.us/j/123'), 'Gabung Zoom', 'commercial zoom subdomains too')
assert.equal(defenseLinkLabel('https://meet.google.com/abc-defg'), 'Gabung Meet')
assert.equal(defenseLinkLabel('https://teams.microsoft.com/l/meetup'), 'Buka Teams')
assert.equal(defenseLinkLabel('https://example.com/room'), 'Buka Tautan')

console.log('defense link: all checks passed')
