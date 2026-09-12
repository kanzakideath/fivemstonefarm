import fs from 'node:fs';

const payloadPath = process.argv[2];
if (!payloadPath) throw new Error('Expression payload path is required.');
const expressions = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class FakeElement {
  constructor(tag = 'div', options = {}) {
    this.tagName = tag.toUpperCase();
    this.id = options.id || '';
    this.classList = new Set(options.classes || []);
    this.attributes = { ...(options.attributes || {}) };
    this.ownText = options.text || '';
    this.children = [];
    this.parentElement = null;
    this.isConnected = true;
    this.clicked = 0;
    this.states = new Set(options.states || []);
    this.rect = options.rect || { left: 0, top: 0, width: 0, height: 0 };
    this.style = {
      visibility: 'visible',
      display: 'block',
      opacity: '1',
      pointerEvents: 'auto',
      animationName: 'none',
      animationPlayState: 'running',
      ...(options.style || {}),
    };
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
    return this;
  }

  get textContent() {
    return this.ownText + this.children.map((child) => child.textContent).join('');
  }

  getBoundingClientRect() {
    return { ...this.rect, right: this.rect.left + this.rect.width,
      bottom: this.rect.top + this.rect.height };
  }

  getAttribute(name) {
    return Object.hasOwn(this.attributes, name) ? String(this.attributes[name]) : null;
  }

  contains(element) {
    for (let current = element; current; current = current.parentElement) {
      if (current === this) return true;
    }
    return false;
  }

  matches(selectorList) {
    return selectorList.split(',').some((raw) => {
      const selector = raw.trim();
      if (!selector) return false;
      if (selector === ':disabled') return this.states.has('disabled');
      if (selector === ':hover') return this.states.has('hover');
      if (selector === ':focus') return this.states.has('focus');
      if (selector === ':focus-within') {
        return this.states.has('focus') || this.querySelector(':focus') !== null;
      }
      if (selector.startsWith('.')) return this.classList.has(selector.slice(1));
      const attribute = selector.match(/^\[([^=\]]+)=([^\]]+)\]$/);
      if (attribute) {
        return this.getAttribute(attribute[1]) === attribute[2].replace(/^['"]|['"]$/g, '');
      }
      return this.tagName.toLowerCase() === selector.toLowerCase();
    });
  }

  descendants() {
    const values = [];
    for (const child of this.children) values.push(child, ...child.descendants());
    return values;
  }

  querySelectorAll(selector) {
    const values = this.descendants();
    return selector === '*' ? values : values.filter((value) => value.matches(selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  closest(selector) {
    for (let current = this; current; current = current.parentElement) {
      if (current.matches(selector)) return current;
    }
    return null;
  }

  click() {
    this.clicked += 1;
  }
}

function createDocument(body) {
  const all = () => [body, ...body.descendants()];
  return {
    body,
    querySelector(selector) {
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        return all().find((element) => element.id === id) || null;
      }
      return all().find((element) => element.matches(selector)) || null;
    },
  };
}

function evaluate(expression, document) {
  const run = new Function('document', 'getComputedStyle', 'innerWidth', 'innerHeight',
    `'use strict'; return ${expression};`);
  return run(document, (element) => element.style, 1000, 800);
}

function washOption(text, left, options = {}) {
  const hit = new FakeElement('div', {
    classes: ['option-container', ...(options.classes || [])],
    rect: { left, top: options.top || 390, width: 180, height: 36 },
    states: options.states,
    style: options.style,
    attributes: options.attributes,
  });
  const leaf = new FakeElement('span', {
    text,
    rect: { left: left + 24, top: options.top || 390, width: 110, height: 30 },
    style: options.leafStyle,
  });
  hit.append(leaf);
  return { hit, leaf };
}

function targetFixture(options = {}) {
  // ox_target uses absolute children, so body/root may validly have a zero rect.
  const body = new FakeElement('body');
  const eye = new FakeElement('div', {
    id: 'eye', rect: { left: 490, top: 390, width: 20, height: 20 },
  });
  const root = new FakeElement('div', { id: 'options-wrapper' });
  const first = washOption('石を洗う', 690, options.first || {});
  const second = washOption(' \n 石を洗う \t', 530, options.second || {});
  root.append(first.hit, second.hit);
  body.append(eye, root);
  return { document: createDocument(body), body, root, eye, first, second };
}

{
  const fixture = targetFixture();
  assert(evaluate(expressions.probe, fixture.document) === true,
    'Two valid wash options must still probe as present.');
  assert(evaluate(expressions.click, fixture.document) === true,
    'Two valid wash options must produce one click.');
  assert(fixture.first.hit.clicked === 0 && fixture.second.hit.clicked === 1,
    'The option nearest the eye must be clicked exactly once.');
}

{
  const fixture = targetFixture({ first: { states: ['hover'] } });
  assert(evaluate(expressions.click, fixture.document) === true,
    'A hovered wash option must remain clickable.');
  assert(fixture.first.hit.clicked === 1 && fixture.second.hit.clicked === 0,
    'Hover selection must outrank distance.');
}

{
  const fixture = targetFixture({ first: { attributes: { 'aria-selected': 'true' } } });
  assert(evaluate(expressions.click, fixture.document) === true,
    'A selected wash option must remain clickable.');
  assert(fixture.first.hit.clicked === 1 && fixture.second.hit.clicked === 0,
    'Selected semantics must outrank distance.');
}

{
  const fixture = targetFixture({
    first: { style: { display: 'none' } },
    second: { attributes: { 'aria-disabled': 'true' } },
  });
  assert(evaluate(expressions.probe, fixture.document) === false,
    'Hidden and disabled wash options must be rejected.');
  assert(evaluate(expressions.click, fixture.document) === false,
    'Rejected wash options must never be clicked.');
  assert(fixture.first.hit.clicked + fixture.second.hit.clicked === 0,
    'A rejected fixture emitted a click.');
}

{
  const body = new FakeElement('body');
  const root = new FakeElement('div', { id: 'options-wrapper' });
  const hit = new FakeElement('button', {
    rect: { left: 520, top: 390, width: 180, height: 36 },
  });
  hit.append(
    new FakeElement('span', {
      text: '石を洗う', rect: { left: 530, top: 392, width: 90, height: 28 },
    }),
    new FakeElement('span', {
      text: '石を洗う', rect: { left: 620, top: 392, width: 70, height: 28 },
    }),
  );
  root.append(hit);
  body.append(root);
  const document = createDocument(body);
  assert(evaluate(expressions.click, document) === true && hit.clicked === 1,
    'Duplicate matching leaves inside one hit target must emit one click.');
}

{
  const fixture = targetFixture({
    first: { style: { pointerEvents: 'none' } },
    second: { leafStyle: { opacity: '0' } },
  });
  assert(evaluate(expressions.click, fixture.document) === false,
    'Pointer-disabled and transparent wash options must be rejected.');
}

{
  const fixture = targetFixture();
  fixture.first.hit.rect.left = fixture.second.hit.rect.left;
  fixture.first.leaf.rect.left = fixture.second.leaf.rect.left;
  assert(evaluate(expressions.click, fixture.document) === true,
    'Equal-distance wash options must still produce a click.');
  assert(fixture.first.hit.clicked === 1 && fixture.second.hit.clicked === 0,
    'DOM order must provide a deterministic final tie-break.');
}

function progressFixture(label, { animated = true, visible = true, paused = false,
  includeToast = false, animationName = 'progress-bar',
  animationPlayState } = {}) {
  const body = new FakeElement('body', {
    rect: { left: 0, top: 0, width: 1000, height: 800 },
  });
  if (animated) {
    const bar = new FakeElement('div', {
      rect: { left: 325, top: 700, width: 350, height: 45 },
      style: {
        animationName,
        animationPlayState: animationPlayState || (paused ? 'paused' : 'running'),
        display: visible ? 'block' : 'none',
      },
    });
    bar.append(new FakeElement('span', {
      text: `${label}..`,
      rect: { left: 390, top: 708, width: 220, height: 28 },
    }));
    body.append(bar);
  }
  if (includeToast) {
    body.append(new FakeElement('div', {
      text: `${label}.. 通知`,
      rect: { left: 20, top: 20, width: 250, height: 40 },
    }));
  }
  return createDocument(body);
}

const workProgressCases = [
  ['progressMine', '採掘中'],
  ['progressWash', '石を洗っています'],
  ['progressGold', '砂金採りをしています'],
];

for (const [expressionName, label] of workProgressCases) {
  const expression = expressions[expressionName];
  assert(evaluate(expression, progressFixture(label)) === true,
    `${label}: a visible running ox_lib progress bar must be detected.`);
  assert(evaluate(expression, progressFixture(label, { visible: false })) === false,
    `${label}: a hidden progress bar must not be detected.`);
  assert(evaluate(expression, progressFixture(label, { paused: true })) === false,
    `${label}: a paused progress bar must not be accepted as active work.`);
  assert(evaluate(expression,
    progressFixture(label, { animated: false, includeToast: true })) === false,
    `${label}: matching toast text must not impersonate the progress component.`);
  assert(evaluate(expression, progressFixture(label, {
    animationName: 'pulse, progress-bar',
    animationPlayState: 'running, paused',
  })) === false,
  `${label}: the play state paired with progress-bar must be running.`);
  assert(evaluate(expression, progressFixture(label, {
    animationName: 'pulse, progress-bar',
    animationPlayState: 'paused, running',
  })) === true,
  `${label}: a running progress-bar in a multi-animation list must be detected.`);
  for (const [, otherLabel] of workProgressCases.filter((entry) => entry[1] !== label)) {
    assert(evaluate(expression, progressFixture(otherLabel)) === false,
      `${label}: another action's progress must not be accepted.`);
  }
}

console.log('Work DOM expression tests passed.');

{
  const fixture = targetFixture();
  const cargo = washOption('ストレージを開く', 492, {states:['hover']});
  fixture.root.append(cargo.hit);
  assert(evaluate(expressions.click, fixture.document) === true, 'Wash must remain selectable beside cargo.');
  assert(cargo.hit.clicked === 0, 'Hovered nearby cargo must never be clicked by washing.');
  assert(fixture.first.hit.clicked + fixture.second.hit.clicked === 1, 'Exactly one wash must be selected.');
}

// Paired task-area evidence must not click, confuse a partial match, or accept
// multiple cargo options. Washing may disappear legitimately at raw stone 0.
for (const label of ['ストレージを開く', 'トランクを開く', '荷台を開く']) {
  const f = targetFixture();
  const cargo = washOption(label, 300, { states: ['hover'] });
  f.root.append(cargo.hit);
  assert(evaluate(expressions.nearby, f.document) === 'PRESENT WASH_STORAGE', 'Both exact usable controls must be accepted.');
  assert(cargo.hit.clicked === 0 && f.first.hit.clicked === 0 && f.second.hit.clicked === 0, 'Probe must never click.');
  f.first.hit.style.display = f.second.hit.style.display = 'none';
  assert(evaluate(expressions.nearby, f.document) === 'PRESENT STORAGE_ONLY', 'Raw stone empty must leave a refill-only proof.');
  cargo.hit.attributes['aria-disabled'] = 'true';
  assert(evaluate(expressions.nearby, f.document) === 'MISSING WASH_STORAGE', 'Disabled cargo cannot authorize continuation.');
}
{
  const f = targetFixture();
  assert(evaluate(expressions.nearby, f.document) === 'MISSING WASH_STORAGE', 'Wash without cargo is not nearby proof.');
  f.root.append(washOption('ストレージを開く', 300).hit, washOption('ストレージを開く', 70).hit);
  assert(evaluate(expressions.nearby, f.document) === 'AMBIGUOUS WASH_STORAGE', 'Two cargo targets must be rejected.');
  f.root.style.display = 'none';
  assert(evaluate(expressions.nearby, f.document) === 'MISSING WASH_STORAGE', 'Hidden interaction list must be rejected.');
}
{
  const f = targetFixture();
  f.root.append(washOption('インベントリを開く', 300).hit);
  assert(evaluate(expressions.nearby, f.document) === 'MISSING WASH_STORAGE', 'A generic inventory control is not registered cargo.');
}
console.log('Paired nearby wash/storage DOM probes passed (no clicks or item transfers).');
