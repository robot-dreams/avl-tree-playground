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
    this.row = null;
    this.col = null;
    this.balanced = null;
  }
}

// Global state
let root = new Node(4);
let selection = root;
let size = 1;

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
    col_start + (col - size / 2) * COL_DELTA,
    row_start + row * ROW_DELTA
  ];
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function findClicked(node, x, y) {
  if (node === null) return null;

  let [cx, cy] = gridToCoords(node.row, node.col);
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

  node.row = row;
  node.col = col + lCount;
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

function drawEdge(row1, col1, row2, col2) {
  let [x1, y1] = gridToCoords(row1, col1);
  let [x2, y2] = gridToCoords(row2, col2);
  addSVG("line", { x1, y1, x2, y2 });
}

function renderEdges(node) {
  if (node.left !== null) {
    drawEdge(node.row, node.col, node.left.row, node.left.col);
    renderEdges(node.left);
  }
  if (node.right !== null) {
    drawEdge(node.row, node.col, node.right.row, node.right.col);
    renderEdges(node.right);
  }
}

function drawNode(value, row, col, balanced) {
  let [cx, cy] = gridToCoords(row, col);
  addSVG("circle", {
    class: balanced ? "node" : "imbalanced",
    cx,
    cy,
    r: NODE_RADIUS
  });

  let text = addSVG("text");
  text.textContent = value;

  let bBox = text.getBBox();
  text.setAttribute("x", cx - bBox.width / 2);
  text.setAttribute("y", cy + bBox.height / 4);
}

function drawImbalanced(row, col) {
  let [cx, cy] = gridToCoords(row, col);
  addSVG("circle", { class: "imbalanced", cx, cy, r: NODE_RADIUS });
}

function renderNodes(node) {
  if (node.left != null) renderNodes(node.left);
  if (node.right != null) renderNodes(node.right);
  // if (!node.balanced) drawImbalanced(node.row, node.col);
  drawNode(node.value, node.row, node.col, node.balanced);
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
  let [cx, cy] = gridToCoords(selection.row, selection.col);
  addSVG("circle", { class: "selection", cx, cy, r: SELECTION_RADIUS });
}

function render() {
  for (let i = SVG_ROOT.children.length - 1; i >= 0; i--)
    SVG_ROOT.children[i].remove();
  positionWalk(root, 0, 0);
  balanceWalk(root);
  renderEdges(root);
  drawSelection();

  renderNodes(root);
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
  let input = prompt("value to add?");
  if (input === null || input.trim() === "") return;

  let value = parseInt(input);
  if (isNaN(value) || value.toString() != input) {
    alert(`"${input}" is not an integer`);
    return;
  }
  if (value < -99 || value > 99) {
    alert(`${value} is out of range; must be in [-99, 99]`);
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
  [4, 2, 1, 3, 6, 5, 7],
  [6, 4, 2, 5, 1, 3, 7],
  [2, 1, 4, 3, 6, 5, 7],
  [6, 2, 1, 4, 3, 5, 7],
  [2, 1, 6, 4, 3, 5, 7]
];

function loadPreset(i) {
  root = new Node(presets[i][0]);
  selection = root;
  size = 1;
  for (let j = 1; j < presets[i].length; j++) add(presets[i][j]);
}

/* Events */

function handleMouseDown(e) {
  let clickedNode = findClicked(root, e.pageX, e.pageY);
  if (clickedNode !== null) {
    selection = clickedNode;
    render(root, selection);
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
      break;
    case 38:
      if (selection.parent !== null) selection = selection.parent;
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
      break;
    case 48:
    case 49:
    case 50:
    case 51:
    case 52:
      loadPreset(e.keyCode - 48);
      break;
    case 65:
      promptAndAdd();
      break;
    case 68:
      deleteSelection();
      break;
    case 69:
      selection = rotateCCW(selection);
      if (selection.parent === null) root = selection;
      break;
    case 81:
      selection = rotateCW(selection);
      if (selection.parent === null) root = selection;
      break;
    default:
      break;
  }
  // TODO: Only re-render when there was a change?
  render(root, selection);
}

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("mousedown", handleMouseDown);

window.onresize = () => {
  render(root, selection);
};

/* Initialization */

document.body.onload = () => {
  loadPreset(0);
  render(root, selection);
  SVG_ROOT.focus();
};
