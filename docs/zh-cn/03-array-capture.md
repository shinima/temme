## 数组捕获 `@`

数组捕获是另外一种形式的捕获, 用于将相似的数据捕获到一个数组中。我们将 `@xxx { /* ... */ }` 放到一个普通的 CSS 选择器（称为父选择器）之后，其中 `@` 符号是数组捕获的标志符，该符号后面必须跟一对花括号。我们在花括号中定义若干个子选择器，用于捕获数组中的内容。

### 语法

- `div.foo@xxx { /* ... */ }`：将 `@xxx { /* ... */ }` 放在一个普通的 CSS 选择器之后
- `div.foo@ { /* children-selector */ }`：省略 xxx 以进行及「默认数组捕获」

注意「数组捕获」中 `@` 符号和花括号总是成对出现的。如果没有出现 `@` 符号，只出现了花括号，则该花括号表示「捕获元素的文本内容」。

### 运行时行为

对于每一个满足父选择器的结点（称为父结点），在该结点下依次执行子选择器。每一个父结点都会产生一个捕获结果，这些结果将会放在一个数组中，作为本次数组捕获的结果。而数组则会存放在上层结果的 `.xxx` 字段。

和「默认值捕获」一样，我们可以省略 xxx 只保留一个 `@` 符号来进行 「默认数组捕获」，此时数组捕获得到的数组会直接成为上层结果。

### 例子

```html
<!-- 下面用到的 html 的内容 -->
<ul>
  <li data-fruit-id="1">
    <span data-color="red">apple</span>
  </li>
  <li data-fruit-id="2">
    <span data-color="white">pear</span>
  </li>
  <li data-fruit-id="3">
    <span data-color="purple">grape</span>
  </li>
</ul>
```

```JavaScript
// 数组捕获
temme(html, 'li@fruits { span[data-color=$color]{$name}; }')
//=>
// {
//   "fruits": [
//     { "color": "red", "name": "apple" },
//     { "color": "white", "name": "pear"  },
//     { "color": "purple", "name": "grape" }
//   ]
// }

// 默认数组捕获
temme(html, 'li@ { span[data-color=$color]{$name}; }')
//=>
// [
//   { "color": "red", "name": "apple" },
//   { "color": "white", "name": "pear"  },
//   { "color": "purple", "name": "grape" }
// ]
```

## 父结点引用 `&`

当我们进行数组捕获的时候，我们需要使用 `&` 来捕获父结点中的数据。该语法和 sass, less 以及 stylus 中的父结点引用的含义一样。

### 例子

```JavaScript
temme(html, 'li@ { &[data-fruit-id=$fid]; }')
//=> [ { "fid": "1" }, { "fid": "2" }, { "fid": "3" } ]
```

## 嵌套的数组捕获

数组捕获可以嵌套使用，将一个数组捕获放在另外一个数组捕获中就可以完成嵌套数组的捕获。[在这个 StackOverflow 的例子中](https://temme.js.org/?example=so-question-detail)，一个问题有多个回答，每个回答有多个评论。我们使用嵌套的数组捕获可以捕获一个评论的二维数组。
