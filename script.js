const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_ROOT = document.getElementsByTagName("svg")[0];

const SVG_TOP_PADDING = 100;

const ROW_DELTA = 60;
const COL_DELTA = 50;

const NODE_RADIUS = 20;
const SELECTION_RADIUS = 25;

class Node {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
    this.parent = null;
    this.balanced = null;

    // For drawing / animation
    this.old_row = null;
    this.old_col = null;
    this.row = null;
    this.col = null;
  }

  getRow() {
    if (animating && this.old_row !== null) {
      return interpolate(this.old_row, this.row);
    } else {
      return this.row;
    }
  }

  getCol() {
    if (animating && this.old_col !== null) {
      return interpolate(this.old_col, this.col);
    } else {
      return this.col;
    }
  }
}

const DURATION = 250;

// Global state
let root = new Node(4);
let selection = root;
let size = 1;

let animating = false;
let startTs = null;
let currTs = null;

function startAnimation() {
  setTimeout(function() {
    calculateLayout();
    animating = true;
    startTs = currTs = document.timeline.currentTime;
    requestAnimationFrame(animationStep);
  }, 0);
}

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function interpolate(src, dst) {
  let x = easeOutExpo((currTs - startTs) / DURATION);
  return (1 - x) * src + x * dst;
}

function animationStep(ts) {
  if (ts - startTs > DURATION) {
    animating = false;
    startTs = null;
    currTs = null;
  } else {
    currTs = ts;
  }
  draw();
  if (animating) {
    requestAnimationFrame(animationStep);
  }
}

function addSVG(tag, attributes) {
  let elem = document.createElementNS(SVG_NS, tag);
  for (let key in attributes) elem.setAttribute(key, attributes[key]);
  SVG_ROOT.appendChild(elem);
  return elem;
}

function gridToCoords(row, col) {
  let rect = SVG_ROOT.getBoundingClientRect();
  let col_start = rect.width / 2;
  let row_start = SVG_TOP_PADDING;
  return [
    col_start + col * COL_DELTA,
    row_start + row * ROW_DELTA
  ];
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function findClicked(node, x, y) {
  if (node === null) return null;

  let [cx, cy] = gridToCoords(node.getRow(), node.getCol());
  let rect = SVG_ROOT.getBoundingClientRect();
  if (distance(cx, cy, x - rect.left, y - rect.top) <= NODE_RADIUS) {
    return node;
  }
  return findClicked(node.left, x, y) || findClicked(node.right, x, y);
}

// In-order traversal to calculate correct
// row / col position for each node
//
// Returns number of nodes traversed
function positionWalk(node, row, col) {
  if (node === null) return 0;

  let lCount = positionWalk(node.left, row + 1, col);
  let rCount = positionWalk(node.right, row + 1, col + lCount + 1);

  node.old_row = node.row;
  node.old_col = node.col;
  node.row = row;
  node.col = col + lCount - (size / 2);
  return lCount + 1 + rCount;
}

// Postorder traversal to calculate subtree heights
// and check balance
//
// Returns height of subtree traversed
function balanceWalk(node) {
  if (node === null) return 0;
  let l = balanceWalk(node.left);
  let r = balanceWalk(node.right);
  node.balanced = Math.abs(l - r) <= 1;
  return 1 + Math.max(l, r);
}

function drawEdge(parent, child) {
  let [x1, y1] = gridToCoords(parent.getRow(), parent.getCol());
  let [x2, y2] = gridToCoords(child.getRow(), child.getCol());
  addSVG("line", { x1, y1, x2, y2 });
}

function drawEdges(node) {
  if (node.left !== null) {
    drawEdge(node, node.left);
    drawEdges(node.left);
  }
  if (node.right !== null) {
    drawEdge(node, node.right);
    drawEdges(node.right);
  }
}

function drawNode(node) {
  let [cx, cy] = gridToCoords(node.getRow(), node.getCol());
  addSVG("circle", {
    class: node.balanced ? "node" : "imbalanced",
    cx,
    cy,
    r: NODE_RADIUS
  });

  let text = addSVG("text");
  text.textContent = node.value;

  let bBox = text.getBBox();
  text.setAttribute("x", cx - bBox.width / 2);
  text.setAttribute("y", cy + bBox.height / 4);
}

function drawImbalanced(row, col) {
  let [cx, cy] = gridToCoords(row, col);
  addSVG("circle", { class: "imbalanced", cx, cy, r: NODE_RADIUS });
}

function drawNodes(node) {
  if (node.left != null) drawNodes(node.left);
  if (node.right != null) drawNodes(node.right);
  // if (!node.balanced) drawImbalanced(node.row, node.col);
  drawNode(node);
}

function height(node) {
  if (node === null) return 0;
  else return 1 + Math.max(height(node.left), height(node.right));
}

function balanced(node) {
  if (node === null) return true;
  else return Math.abs(height(node.left) - height(node.right)) <= 1;
}

function drawSelection() {
  let [cx, cy] = gridToCoords(selection.getRow(), selection.getCol());
  addSVG("circle", { class: "selection", cx, cy, r: SELECTION_RADIUS });
}

function calculateLayout() {
  positionWalk(root, 0, 0);
  balanceWalk(root);
}

function draw() {
  for (let i = SVG_ROOT.children.length - 1; i >= 0; i--)
    SVG_ROOT.children[i].remove();
  drawEdges(root);
  drawSelection();
  drawNodes(root);
}

/* Tree mutations */

function replaceChild(parent, oldChild, newChild) {
  if (newChild !== null) newChild.parent = parent;
  if (parent !== null) {
    if (parent.left === oldChild) parent.left = newChild;
    else parent.right = newChild;
  }
}

function setLeftChild(parent, child) {
  if (parent !== null) parent.left = child;
  if (child !== null) child.parent = parent;
}

function setRightChild(parent, child) {
  if (parent !== null) parent.right = child;
  if (child !== null) child.parent = parent;
}

//    a     b
//   /  ->   \
//  b         a
function rotateCW(node) {
  if (node.left === null) return node;

  let a = node;
  let b = node.left;

  replaceChild(a.parent, a, b);
  setLeftChild(a, b.right);
  setRightChild(b, a);

  return b;
}

//  a        b
//   \  ->  /
//    b    a
function rotateCCW(node) {
  if (node.right === null) return node;

  let a = node;
  let b = node.right;

  replaceChild(a.parent, a, b);
  setRightChild(a, b.left);
  setLeftChild(b, a);

  return b;
}

// Precondition: node != null
//
// Returns newly added node
function addRecursive(node, value) {
  if (value <= node.value) {
    if (node.left !== null) {
      return addRecursive(node.left, value);
    } else {
      let child = new Node(value);
      setLeftChild(node, child);
      return child;
    }
  } else {
    if (node.right !== null) {
      return addRecursive(node.right, value);
    } else {
      let child = new Node(value);
      setRightChild(node, child);
      return child;
    }
  }
}

function add(value) {
  size++;
  return addRecursive(root, value);
}


function promptAndAdd() {
  let input = prompt("value to add (integer between -99 and 99)?");
  if (input === null || input.trim() === "") return;

  input = input.trim();
  let value = parseInt(input);
  if (isNaN(value) || value.toString() != input) {
    alert(`"${input}" is not an integer`);
    return;
  }
  if (value < -99 || value > 99) {
    alert(`${value} is out of range (must be between -99 and 99)`);
    return;
  }

  selection = add(value);
}

// Preconditions
// - node !== null
// - size > 1
function deleteRecursive(node) {
  if (node.left === null && node.right === null) {
    replaceChild(node.parent, node, null);
    return node.parent;
  } else if (node.left === null) {
    replaceChild(node.parent, node, node.right);
    return node.right;
  } else if (node.right === null) {
    replaceChild(node.parent, node, node.left);
    return node.left;
  } else {
    // node.left !== null && node.right !== null
    let successor = node.left;
    while (successor.right !== null) successor = successor.right;
    node.value = successor.value;
    deleteRecursive(successor);
    return node;
  }
}

function deleteSelection() {
  if (size === 1) {
    alert("can't delete last node in tree");
    return;
  }

  let reroot = root === selection;
  selection = deleteRecursive(selection);
  if (reroot) root = selection;

  size--;
}

const presets = [
  [2, 1, 3],
  [4, 2, 1, 3, 6, 5, 7],
  [8, 4, 2, 1, 3, 6, 5, 7, 12, 10, 9, 11, 14, 13, 15],
  [3, 1, 2, 6, 5, 4, 7],
  [6, 4, 2, 5, 1, 3, 7],
  [6, 2, 1, 4, 3, 5, 7],
  [1, 2, 3, 4, 5, 6, 7],
  [4, 3, 2, 1, 5, 6, 7],
];

function loadPreset(i) {
  root = new Node(presets[i][0]);
  selection = root;
  size = 1;
  for (let j = 1; j < presets[i].length; j++) add(presets[i][j]);
  calculateLayout();
}

/* Events */

function handleMouseDown(e) {
  let clickedNode = findClicked(root, e.pageX, e.pageY);
  if (clickedNode !== null) {
    selection = clickedNode;
    draw();
  }
}

function handleKeyDown(e) {
  switch (e.keyCode) {
    case 37:
      if (selection.left !== null) {
        selection = selection.left;
      } else if (
        selection.parent !== null &&
        selection.parent.right == selection
      ) {
        selection = selection.parent;
      }
      draw();
      break;
    case 38:
      if (selection.parent !== null) selection = selection.parent;
      draw();
      break;
    case 39:
      if (selection.right !== null) {
        selection = selection.right;
      } else if (
        selection.parent !== null &&
        selection.parent.left == selection
      ) {
        selection = selection.parent;
      }
      draw();
      break;
    case 40:
      let children = 0;
      if (selection.left !== null) {
        children++;
      }
      if (selection.right !== null) {
        children++;
      }
      if (children == 1) {
        selection = selection.left || selection.right;
      }
      draw();
      break;
    case 49:
    case 50:
    case 51:
    case 52:
    case 53:
    case 54:
    case 55:
    case 56:
      loadPreset(e.keyCode - 49);
      draw();
      break;
    case 65:
      promptAndAdd();
      startAnimation();
      break;
    case 68:
      deleteSelection();
      startAnimation();
      break;
    case 69:
      selection = rotateCCW(selection);
      if (selection.parent === null) root = selection;
      startAnimation();
      break;
    case 81:
      selection = rotateCW(selection);
      if (selection.parent === null) root = selection;
      startAnimation();
      break;
    default:
      break;
  }
}

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("mousedown", handleMouseDown);

window.onresize = () => {
  draw();
};

/* Initialization */

document.body.onload = () => {
  loadPreset(1);
  draw();
  SVG_ROOT.focus();
};
