const {
  readFileSync
} = require('fs')
const {
  resolve
} = require('path')
const svelte = require('svelte')
const magicalPreprocess = require('../src')
const { getLanguage } = require('../src/utils.js')

const getFixtureContent = (file) => readFileSync(resolve(__dirname, 'fixtures', file)).toString().trim()

const doesThrow = async (input, opts) => {
  let didThrow = false
  try {
    await preprocess(input, opts)
  } catch (err) {
    didThrow = err.message.includes('svelte-preprocess')
  }
  return didThrow
}

const cssRegExp = /div\.svelte-\w{4,7}\{color:(red|#f00)\}/
const parsedMarkup = getFixtureContent('template.html')
const parsedJs = getFixtureContent('script.js')

const preprocess = async (input, magicOpts) => {
  const preprocessed = await svelte.preprocess(input, {
    filename: resolve(__dirname, 'App.svelte'),
    ...magicOpts
  })
  return preprocessed.toString()
}

const compile = async (input, magicOpts) => {
  const preprocessed = await preprocess(input, magicOpts)
  const {
    js,
    css
  } = svelte.compile(preprocessed.toString(), {
    css: true
  })

  return {
    js,
    css
  }
}

const LANGS = {
  /** ['languageName', 'fixtureExtension'] */
  MARKUP: [
    ['pug', 'pug']
  ],
  SCRIPT: [
    ['coffeescript', 'coffee']
  ],
  STYLE: [
    ['less', 'less'],
    ['scss', 'scss'],
    ['stylus', 'styl']
  ]
}


describe('template tag', () => {
  it('should parse HTML between <template></template>', async () => {
    const input = `<template><div>Hey</div></template>`
    const opts = magicalPreprocess()
    expect(await preprocess(input, opts)).toBe(parsedMarkup)
  })

  it('should parse external HTML', async () => {
    const input = `<template src="./fixtures/template.html"></template>`
    const opts = magicalPreprocess()
    expect(await preprocess(input, opts)).toBe(parsedMarkup)
  })

  it('should parse external javascript', async () => {
    const input = `
      <div></div>
      <script src="./fixtures/script.js"></script>
    `
    const opts = magicalPreprocess()
    const preprocessed = await preprocess(input, opts)
    expect(preprocessed).toContain(parsedJs)
  })

  it('should parse external css', async () => {
    const input = `
      <div></div>
      <style src="./fixtures/style.css"></style>
    `
    const opts = magicalPreprocess()
    const compiled = await compile(input, opts)
    expect(compiled.css.code).toMatch(cssRegExp)
  })
})


LANGS.MARKUP.forEach(([lang, ext]) => {
  describe(`markup - preprocessor - ${lang}`, () => {
    const template = `<template lang="${lang}">${getFixtureContent('template.' + ext)}</template>`
    const templateExternal = `<template src="./fixtures/template.${ext}"></template>`

    it(`should throw parsing ${lang} when { ${lang}: false }`, async () => {
      const opts = magicalPreprocess({
        transformers: {
          pug: false
        }
      })
      expect(await doesThrow(template, opts)).toBe(true)
    })

    it(`should parse ${lang}`, async () => {
      const opts = magicalPreprocess()
      const preprocessed = (await preprocess(template, opts)).trim()
      expect(preprocessed).toBe(parsedMarkup)
    })

    it(`should parse external ${lang}`, async () => {
      const opts = magicalPreprocess()
      expect(await preprocess(templateExternal, opts)).toBe(parsedMarkup)
    })
  })
})

LANGS.SCRIPT.forEach(([lang, ext]) => {
  describe(`script - preprocessor - ${lang}`, () => {

    const template = `
      <div></div>
      <script lang="${lang}">${getFixtureContent('script.' + ext)}</script>
    `

    const templateExternal = `
      <div></div>
      <script src="./fixtures/script.${ext}"></script>
    `

    it(`should throw parsing ${lang} when { ${lang}: false }`, async () => {
      const input = `
        <div></div>
        <script src="./fixtures/script.${ext}"></script>
      `
      const opts = magicalPreprocess({
        transformers: {
          [lang]: false
        }
      })
      expect(await doesThrow(input, opts)).toBe(true)
    })

    it(`should parse ${lang}`, async () => {
      const opts = magicalPreprocess()
      const preprocessed = await preprocess(template, opts)
      expect(preprocessed).toContain(parsedJs)
    })

    it(`should parse external ${lang}`, async () => {
      const opts = magicalPreprocess()
      const preprocessed = await preprocess(templateExternal, opts)
      expect(preprocessed).toContain(parsedJs)
    })
  })
})

LANGS.STYLE.forEach(([lang, ext]) => {
  describe(`style - preprocessor - ${lang}`, () => {
    const template = `
      <div></div>
      <style lang="${lang}">${getFixtureContent('style.' + ext)}</style>
    `

    const templateExternal = `
      <div></div>
      <style src="./fixtures/style.${ext}"></style>
    `

    it(`should throw parsing ${lang} when { ${lang}: false }`, async () => {
      const opts = magicalPreprocess({
        transformers: {
          [lang]: false
        }
      })
      expect(await doesThrow(template, opts)).toBe(true)
    })

    it(`should parse ${lang}`, async () => {
      const opts = magicalPreprocess()
      const compiled = await compile(template, opts)
      expect(compiled.css.code).toMatch(cssRegExp)
    })

    it(`should parse external ${lang}`, async () => {
      const opts = magicalPreprocess()
      const compiled = await compile(templateExternal, opts)
      expect(compiled.css.code).toMatch(cssRegExp)
    })
  })
})

describe('style - postcss', () => {
  const template = `<div></div><style>div{appearance:none;}</style>`
  const templateSass = `<div></div><style lang="scss">div{appearance:none;}</style>`
  const opts = magicalPreprocess({
    transformers: {
      postcss: {
        plugins: [
          require('autoprefixer')({
            browsers: 'Safari >= 5.1'
          })
        ]
      }
    }
  })

  it('should parse text/postcss and lang="postcss" as css', async () => {
    expect(getLanguage({ type:'text/postcss' }, 'css')).toBe('css')
    expect(getLanguage({ lang:'postcss' }, 'css')).toBe('css')
  })

  it('should not transform plain css with postcss if { postcss: falsy }', async () => {
    const compiled = await compile(template, magicalPreprocess())
    expect(compiled.css.code).not.toMatch(/-webkit-/)
  })

  it('should transform plain css with postcss if { postcss: true }', async () => {
    const compiled = await compile(template, opts)
    expect(compiled.css.code).toMatch(/-webkit-/)
  })

  it('should transform async preprocessed css with postcss if { postcss: true }', async () => {
    const compiled = await compile(templateSass, opts)
    expect(compiled.css.code).toMatch(/-webkit-/)
  })
})

describe('options', () => {
  it('should accept custom method for a transformer', async () => {
    const input = `<template src="./fixtures/template.pug"></template>`
    const opts = magicalPreprocess({
      pug: (content, filename) => {
        const code = require('pug').render(content, opts)
        return {
          code
        }
      }
    })
    const preprocessed = (await preprocess(input, opts)).trim()
    expect(preprocessed).toBe(parsedMarkup)
  })

  it('should accept an options object as transformer value', async () => {
    const input = `
    <div></div>
    <style src="./fixtures/style.scss"></style>
    `
    const opts = magicalPreprocess({
      scss: {
        includedPaths: ['node_modules']
      }
    })
    const compiled = (await compile(input, opts))
    expect(compiled.css.code).toMatch(cssRegExp)
  })

  it('should execute a onBefore method before transforming markup', async () => {
    const input = ``
    const opts = magicalPreprocess({
      onBefore({
        content
      }) {
        return '<template src="./fixtures/template.pug"></template>'
      }
    })
    const preprocessed = (await preprocess(input, opts)).trim()
    expect(preprocessed).toBe(parsedMarkup)
  })

  it('should append aliases to the language alias dictionary', async () => {
    const input = `<div></div><style lang="customLanguage"></style>`
    const opts = magicalPreprocess({
      aliases: [
        ['customLanguage', 'css']
      ]
    })
    expect(await doesThrow(input, opts)).toBe(false)
  })
})