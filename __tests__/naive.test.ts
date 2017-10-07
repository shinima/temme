import { default as temme, cheerio } from '../src/temme'

test('empty selector', () => {
  const html = `<p>A B C D</p>`
  expect(temme(html, '')).toBeNull()
  expect(temme(html, '   ')).toBeNull()
  expect(temme(html, '\t\t  \n\n')).toBeNull()
})

describe('test filters', () => {
  test('use String#split as filter in value-capture', () => {
    const html = `<p>A B C D</p>`
    const selector = `p{$|split(' ')}`
    expect(temme(html, selector)).toEqual(['A', 'B', 'C', 'D'])
  })

  test('use Array#slice as filter in array-capture', () => {
    const html = `
  <ul>
    <li>apple</li>
    <li>banana</li>
    <li>cherry</li>
    <li>pear</li>
    <li>watermelon</li>
  </ul>
  `
    const selector = 'li@|slice(1,4){ &{$} }'
    expect(temme(cheerio.load(html), selector)).toEqual([
      'banana',
      'cherry',
      'pear',
    ])
  })
})

test('multiple selectors at root level', () => {
  const html = `
  <ul>
    <li class="name">shinima</li>
    <li class="country">China</li>
    <li class="city">Hangzhou, Zhejiang</li>
    <li class="university">ZJU</li>
  </ul>`

  const selector = `
    .name{$name},
    .country{$country},
    .city{$city},
    .university{$university},
  `
  expect(temme(html, selector)).toEqual({
    name: 'shinima',
    country: 'China',
    city: 'Hangzhou, Zhejiang',
    university: 'ZJU',
  })
})

test('temme(html, selector) supports html as CheerioElement', () => {
  const html = `
  <ul>
    <li class="name">shinima</li>
    <li class="country">China</li>
    <li class="city">Hangzhou, Zhejiang</li>
    <li class="university">ZJU</li>
  </ul>`

  const selector = `.name{$}`
  const $ = cheerio.load(html)
  const cheerioElement = $('li').get(0)
  expect(temme(cheerioElement, selector)).toBe('shinima')
})

test('attr predicate and value capture without element in attribute', () => {
  const html = `
  <ul>
    <li class="name" data-full-name="Shi Feichao">shinima</li>
    <li class="country">China</li>
  </ul>`

  const selector = `
    [class=name][data-full-name=$fullName],
    [class=country]{$country},
  `
  expect(temme(html, selector)).toEqual({
    fullName: 'Shi Feichao',
    country: 'China',
  })
})

test('try to capture a non-existent attribute', () => {
  const html = '<div color=red speed=fast power=great>TEXT</div>'
  expect(temme(html, 'div[name=$name age=$age]')).toBeNull()
})

test('using the special node filter', () => {
  const html = '<div color=red speed=fast power=great>TEXT</div>'
  const node: Cheerio = temme(html, 'div{$|node}')
  expect(node.text()).toBe('TEXT')
  expect(node.attr('color')).toBe('red')
  expect(node.attr('speed')).toBe('fast')
  expect(node.attr('power')).toBe('great')
})

test('test pseudo-qualifier. pseudo-qualifer is not supported now and should be ignored', () => {
  const html = '<div color=red speed=fast power=great>TEXT</div>'
  expect(temme(html, 'div[color=$color speed=$speed]:first-child{$text}'))
    .toEqual({
      color: 'red',
      speed: 'fast',
      text: 'TEXT',
    })
})

describe('assigments in different places', () => {
  test('assignments at top level', () => {
    expect(temme('', "$str = '123'")).toEqual({
      str: '123',
    })
    expect(temme('', '$str = "double-quote"')).toEqual({
      str: 'double-quote',
    })
    expect(temme('', '$num = 1234')).toEqual({
      num: 1234,
    })
    expect(temme('', '$nil = null')).toEqual({
      nil: null,
    })
    expect(temme('', '$T = true, $F = false')).toEqual({
      T: true,
      F: false,
    })
  })

  test('assignments in array capture', () => {
    const html = `
  <ul>
    <li>apple</li>
    <li>banana</li>
    <li>cherry</li>
    <li>pear</li>
    <li>watermelon</li>
  </ul>
  `
    const selector = `
    li@ {
      $foo = 'bar',
    },
  `
    expect(temme(html, selector)).toEqual([
      { foo: 'bar' },
      { foo: 'bar' },
      { foo: 'bar' },
      { foo: 'bar' },
      { foo: 'bar' },
    ])
  })

  test('assignments in content part', () => {
    const html = `<div></div>`
    const selector = `
    div { $divFound = true };
    li { $liFound = true };
  `
    const result = temme(html, selector)
    expect(result.divFound).toBeTruthy()
    expect(result.liFound).toBeFalsy()
  })

  test('assignments at top level and in content part', () => {
    const html = `
    <div>
      <ul>
        <li></li>
        <li></li>
      </ul>
    </div>
  `
    const selector = `
    $div = false;
    $ul = false;
    $li = false;
    $table = false;
    $a = false;
    div { $div = true };
    ul { $ul = true };
    li { $li = true };
    table { $table = true };
    a { $a = true };
  `
    expect(temme(html, selector)).toEqual({
      div: true,
      ul: true,
      li: true,
      table: false,
      a: false,
    })
  })
})

describe('using " ", "+", ">" and "~" as section seperators', () => {
  const html = `
    <p>text-0</p>
    <div>
      <article>
        <p>text-1</p>
      </article>
      <p>text-2</p>
      <div></div>
      <p>text-3</p>
    </div>
    <p>text-4</p>
    <p>text-5</p>
  `

  test('test " "', () => {
    expect(temme(html, 'div p@{ &{$} }')).toEqual(['text-1', 'text-2', 'text-3'])
  })

  test('test "+"', () => {
    expect(temme(html, 'div +p@{ &{$} }')).toEqual(['text-3', 'text-4'])
  })

  test('test ">"', () => {
    expect(temme(html, 'div >p@{ &{$} }')).toEqual(['text-2', 'text-3'])
  })

  test('test "~"', () => {
    expect(temme(html, 'div ~p@{ &{$} }')).toEqual(['text-3', 'text-4', 'text-5'])
  })
})
