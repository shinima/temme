import * as cheerio from 'cheerio'
import makeGrammarErrorMessage from './makeGrammarErrorMessage'
import { defaultFilterMap, defineFilter, FilterFn, FilterFnMap } from './filters'

/* 准备temmeParser.
  在webpack build的时候, 用pegjs-loader来载入parser
  在jest的时候, 使用fs来载入语法文件, 然后用pegjs程序生成parser
*/
declare const WEBPACK_BUILD: boolean
let temmeParser: any
if (typeof WEBPACK_BUILD !== 'undefined' && WEBPACK_BUILD) {
  temmeParser = require('./grammar.pegjs')
} else {
  const fs = require('fs')
  const pegjs = require('pegjs')
  const source = fs.readFileSync('./src/grammar.pegjs', 'utf8')
  temmeParser = pegjs.generate(source)
}

export { cheerio, defineFilter, temmeParser, defaultFilterMap, FilterFn, FilterFnMap, makeGrammarErrorMessage }

export const errors = {
  // funcNameNotSupported(f: string) {
  //   return `${f} is not a valid content func-name.`
  // },
  hasLeadingCapture() {
    return 'Attr capturing and content matching/capturing are only allowed in the last part of css-selector. Capture in leading css-selectors will be omitted. Did you forget the comma?'
  },
}

const defaultCaptureKey = '@@default-capture@@'
const ignoreCaptureKey = '@@ignore-capture@@'

// TODO filterList: [] -> null
const ignoreCapture: Capture<string> = { capture: ignoreCaptureKey, filterList: [] }

export interface Dict<V> {
  [key: string]: V
}

export type JSLiteral = string | number | boolean | RegExp | null | undefined

export type TemmeSelector = SelfSelector | NormalSelector | AssignmentSelector

export interface NormalSelector {
  type: 'normal'
  name: string
  css: CssSlice[]
  children: TemmeSelector[]
  filterList: Filter[]
}

export interface SelfSelector {
  type: 'self'
  id: string
  classList: string[]
  attrList: CssAttr[]
  content: ContentPart[]
}
/**
 * 赋值选择器. 该选择器执行的时候, 会在结果中添加指定的值到指定的字段
 * 例如`$a = 123`, 其执行结果为 { a: 123 }
 */
export interface AssignmentSelector {
  type: 'assignment'
  capture: Capture<string>
  value: JSLiteral
}

export interface CssAttr {
  name: string
  value: string | Capture<string>
}

export type CaptureResult = any

export interface CssSlice {
  direct: boolean
  tag: string
  id: string
  classList: string[]
  attrList: CssAttr[]
  content: ContentPart[]
}

export type ContentPart = {
  funcName: FuncName
  args: ContentPartArg[]
}
export type ContentPartArg = string | Capture<string>
export type FuncName = 'text' | 'html' | 'node' | 'contains'

export interface Capture<T> {
  capture: T
  filterList: Filter[]
}

export interface Filter {
  name: string
  args: string[]
}

function isEmptyObject(x: any) {
  return typeof x === 'object'
    && Object.getPrototypeOf(x) === Object.prototype
    && Object.keys(x).length === 0
}

function isCheerioStatic(arg: CheerioStatic | CheerioElement): arg is CheerioStatic {
  return typeof (<CheerioStatic>arg).root === 'function'
}

function containsAnyCaptureInAttrListOrContent(slices: CssSlice[]) {
  return slices.some(part => {
    const hasAttrCapture = part.attrList && part.attrList.some(attr => typeof attr.value !== 'string')
    if (hasAttrCapture) {
      return true
    }
    const hasContentCapture = part.content && part.content.length > 0
    if (hasContentCapture) {
      return true
    }
    return false
  })
}

// notice 递归的检查 selector是否合法
function check(selector: TemmeSelector) {
  if (selector.type === 'self') {
  } else if (selector.type === 'assignment') {
  } else {
    const cssPartsLength = selector.css.length
    const leadingParts = selector.css.slice(0, cssPartsLength - 1)
    const hasLeadingCapture = containsAnyCaptureInAttrListOrContent(leadingParts)
    if (hasLeadingCapture) {
      throw new Error(errors.hasLeadingCapture())
    }
    if (selector.children) {
      for (const child of selector.children) {
        check(child)
      }
    }
  }
}

export function mergeResult<T, S>(target: T, source: S): T & S {
  for (const key in source) {
    if (source[key] != null) {
      (<any>target)[key] = source[key]
    }
  }
  return target as any
}

export default function temme(html: string | CheerioStatic | CheerioElement,
  selector: string | TemmeSelector[],
  extraFilters: { [key: string]: FilterFn } = {}) {
  let $: CheerioStatic
  if (typeof html === 'string') {
    $ = cheerio.load(html, { decodeEntities: false })
  } else if (isCheerioStatic(html)) {
    $ = html
  } else {
    $ = cheerio.load(html)
  }

  let rootSelector: TemmeSelector[]
  if (typeof selector === 'string') {
    try {
      rootSelector = temmeParser.parse(selector) as TemmeSelector[]
    } catch (error) {
      const message = makeGrammarErrorMessage(selector, error)
      throw new Error(message)
    }
  } else {
    rootSelector = selector
  }
  if (rootSelector == null) {
    return null
  }

  const filterFnMap: FilterFnMap = Object.assign({}, defaultFilterMap, extraFilters)
  rootSelector.forEach(check)
  return helper($.root(), rootSelector)

  function helper(cntCheerio: Cheerio, selectorArray: TemmeSelector[]) {
    const result: CaptureResult = {}
    selectorArray.map(selector => {
      if (selector.type === 'normal') {
        const cssSelector = makeNormalCssSelector(selector.css)
        const subCheerio = cntCheerio.find(cssSelector)
        if (subCheerio.length > 0) {
          const capturer = makeValueCapturer(selector.css)
          mergeResult(result, capturer(subCheerio))

          if (selector.name && selector.children) {
            const beforeValue = subCheerio.toArray()
              .map(sub => helper($(sub), selector.children))
            result[selector.name] = applyFilters(beforeValue, selector.filterList)
          }
        } else if (selector.name) {
          result[selector.name] = applyFilters([], selector.filterList)
        }
      } else if (selector.type === 'self') {
        const cssSelector = makeNormalCssSelector([{
          direct: false,
          tag: '',
          id: selector.id,
          classList: selector.classList,
          attrList: selector.attrList,
          content: selector.content,
        }])
        if (cssSelector === '' || cntCheerio.is(cssSelector)) {
          const capturer = makeSelfCapturer(selector)
          mergeResult(result, capturer(cntCheerio))
        }
      } else { // selector.type === 'assignment'
        result[selector.capture.capture] = applyFilters(selector.value, selector.capture.filterList)
      }
    })
    delete result[ignoreCaptureKey]

    let returnVal = result
    if (result.hasOwnProperty(defaultCaptureKey)) {
      returnVal = result[defaultCaptureKey]
    }
    if (returnVal == null || isEmptyObject(returnVal)) {
      return null
    } else {
      return returnVal
    }
  }

  function applyFilters(initValue: any, filterList: Filter[]) {
    return filterList.reduce((value, filter) => {
      if (filter.name in filterFnMap) {
        const filterFn = filterFnMap[filter.name]
        return filterFn.apply(value, filter.args)
      } else if (typeof value[filter.name] === 'function') {
        const filterFn: FilterFn = value[filter.name]
        return filterFn.apply(value, filter.args)
      } else {
        throw new Error(`${filter.name} is not a valid filter.`)
      }
    }, initValue)
  }

  function captureAttrs(node: Cheerio, attrList: CssAttr[]) {
    const result: CaptureResult = {}
    for (const attr of attrList) {
      if (typeof attr.value === 'object') {
        const value = node.attr(attr.name)
        if (value !== undefined) {
          result[attr.value.capture] = applyFilters(value, attr.value.filterList)
        }
      }
      // todo 这里是否需要同时验证匹配? 例如 foo=bar
    }
    return result
  }

  function captureContent(node: Cheerio, content: ContentPart[]) {
    const result: CaptureResult = {}
    for (const part of content) {
      // 目前只支持这几个func
      // console.assert(['text', 'html', 'node', 'contains'].includes(part.funcName),
      // errors.funcNameNotSupported(part.funcName))
      // 至少有一个是value-capture
      // console.assert(part.args.some(isCapture),
      //   errors.needValueCapture(part.funcName))
      // 不能出现连续两个值捕获
      console.assert(!hasConsecutiveValueCapture(part.args))

      if (part.funcName === 'text') {
        const textCaptureResult = captureString(node.text(), part.args)
        if (textCaptureResult == null) {
          return null
        }
        mergeResult(result, textCaptureResult)
      } else if (part.funcName === 'html') {
        const htmlCaptureResult = captureString(node.html(), part.args)
        if (htmlCaptureResult == null) {
          return null
        }
        mergeResult(result, htmlCaptureResult)
      } else if (part.funcName === 'node') {
        console.assert(part.args.length === 1)
        const arg = part.args[0]
        if (typeof arg === 'object') {
          result[arg.capture] = applyFilters(cheerio(node), arg.filterList)
        } else {
          throw new Error('Content func `node` must be in `node($foo)` form')
        }
      } else if (part.funcName === 'contains') {
        console.assert(part.args.length === 1)
        const arg = part.args[0]
        if (typeof arg === 'string') {
          // contains('<some-text>') -> text(_, '<some-text>', _)
          const textCaptureResult = captureString(node.text(), [ignoreCapture, arg, ignoreCapture])
          if (textCaptureResult == null) {
            return null
          }
          mergeResult(result, textCaptureResult)
        } else {
          throw new Error('Content func `contains` must be in `text(<some-text>)` form')
        }
      } else {
        throw new Error(`${part.funcName} is not a valid content-func.`)
      }
    }
    return result
  }

  function makeSelfCapturer(selfSelector: SelfSelector) {
    return (node: Cheerio) => {
      const result: CaptureResult = {}
      if (selfSelector.attrList) {
        mergeResult(result, captureAttrs(node, selfSelector.attrList))
      }
      if (selfSelector.content) {
        const contentCaptureResult = captureContent(node, selfSelector.content)
        if (contentCaptureResult == null) {
          return null
        }
        mergeResult(result, contentCaptureResult)
      }
      return result
    }
  }

  // 对string进行多段匹配/捕获. 匹配之前会先调用String#trim来修剪参数s
  // matchString('I like apple', ['I', { capture: 'foo' }])的结果为
  //  { foo: ' like apple' }
  // 如果匹配失败, 则返回null
  // todo 需要用回溯的方法来正确处理多种匹配选择的情况
  function captureString(s: string, args: ContentPartArg[]) {
    const trimed = s.trim()
    const result: Dict<string> = {}
    // 标记正在进行的capture, null表示没有在捕获中
    let capturing: Capture<string> = null
    let charIndex = 0
    for (const arg of args) {
      if (typeof arg === 'string') {
        if (capturing) {
          const c = trimed.indexOf(arg, charIndex)
          if (c === -1) {
            return null
          } else {
            result[capturing.capture] = applyFilters(trimed.substring(charIndex, c), capturing.filterList)
            capturing = null
            charIndex = c + arg.length
          }
        } else {
          if (trimed.substring(charIndex).startsWith(arg)) {
            charIndex += arg.length
          } else {
            return null // fail
          }
        }
      } else { // arg is value capture
        capturing = arg
      }
    }
    if (capturing) {
      result[capturing.capture] = applyFilters(trimed.substring(charIndex).trim(), capturing.filterList)
      charIndex = s.length
    }
    if (charIndex !== s.length) {
      // 字符串结尾处还有字符尚未匹配
      return null
    }
    return result
  }

  // todo makeValueCapturer命名是不是有问题???
  function makeValueCapturer(cssPartArray: CssSlice[]) {
    return (node: Cheerio) => {
      const result: CaptureResult = {}
      // notice 目前只能在最后一个part中进行value-capture
      const lastCssPart = cssPartArray[cssPartArray.length - 1]
      if (lastCssPart.attrList) {
        mergeResult(result, captureAttrs(node, lastCssPart.attrList))
      }
      if (lastCssPart.content) {
        const contentCaptureResult = captureContent(node, lastCssPart.content)
        if (contentCaptureResult == null) {
          return null
        }
        mergeResult(result, contentCaptureResult)
      }
      return result
    }
  }
}

function hasConsecutiveValueCapture(args: ContentPartArg[]) {
  for (let i = 1; i < args.length; i++) {
    const prev = typeof args[i - 1] === 'object'
    const cnt = typeof args[i] === 'object'
    if (prev && cnt) {
      return true
    }
  }
  return false
}

/** 根据CssPart数组构造标准的css selector */
function makeNormalCssSelector(cssPartArray: CssSlice[]) {
  const seperator = ' '
  const result: string[] = []
  cssPartArray.forEach((cssPart, index) => {
    if (index !== 0) {
      result.push(seperator)
    }
    if (cssPart.direct) {
      result.push('>')
    }
    if (cssPart.tag) {
      result.push(cssPart.tag)
    }
    if (cssPart.id) {
      result.push('#' + cssPart.id)
    }
    if (cssPart.classList) {
      cssPart.classList.forEach(cls => result.push('.' + cls))
    }
    if (cssPart.attrList && cssPart.attrList.some(attr => (typeof attr.value === 'string'))) {
      result.push('[')
      cssPart.attrList.forEach(attr => {
        if (attr.value === '') {
          result.push(attr.name)
        } else if (typeof attr.value === 'string') {
          result.push(`${attr.name}="${attr.value}"`)
        } else { // value-capture
          result.push(seperator)
        }
      })
      result.push(']')
    }
  })
  return result.join('')
}