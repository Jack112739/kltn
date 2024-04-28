"use strict";
import GraphHistory from './HistoryUI.js';
import NodeUI, {hints} from './NodeUI.js'
import GraphUI from './GraphUI.js';

export default class EdgeUI {

    /**@type {LeaderLine>} sometime work as a shared pointer, count odd = owned, count/2 = borrow*/
    repr;
    /**@type {NodeUI} the parent of where this node was stolen from */
    from;
    /**@type {NodeUI} */
    alias
    /** @type {NodeUI[]} */
    hierarchy;
    /**@type {number} */
    offset_to;
    /**@type {number} */
    offset_from;
    /**@type {NodeUI?} appear when we want to shorten the proof this is a singly linked list*/
    truncate;
    /**@type {SVGElement} */
    svg;

    /**@param {NodeUI} from @param {NodeUI} to */
    constructor(from, to, option) {
        this.from = from.is_pseudo ? from.ref : from;
        this.alias = from;
        this.hierarchy = [to];
        this.repr = new LeaderLine(from.html_div, to.html_div, option);
        this.repr.count = 1;
        this.svg = document.body.lastChild;
        this.offset_to = 0;
        this.offset_from = 0;
        from.parent.child_div.appendChild(this.svg);
        this.from.math.to.set(to, this);
        to.math.from.set(this.from, this);
        from.display.to.set(to, this);
        to.display.from.set(from, this);
        for(let cur = to.parent; cur !== this.from.parent; cur = cur.parent) {
            if(cur.parent === from.parent) this.offset_from = this.hierarchy.length;
            this.hierarchy.push(cur);
            cur.external_ref.add(this);
        }
        this.adjust_svg();
        //TODO : create some explaination for this (automatically ?)
        this.truncate = null;
    }
    /**@param {NodeUI} to */
    adjust_svg() {
        let screen = document.documentElement.getBoundingClientRect();
        let actual = this.stored.getBoundingClientRect();
        let dx = actual.x - this.stored.scrollLeft - screen.x;
        let dy = actual.y - this.stored.scrollTop - screen.y;
        this.svg.setAttribute('transform', `translate(${-dx}, ${-dy})`);
    }
    // if the start plug is not rendered correctly
    refresh() {
        /** @type {NodeUI} */
        let current = window.MathGraph.current;
        if(this.from.ref && this.from.ref.parent !== current) {
            EdgeUI.reclaim_edges(this.from.ref);
        }
        if(!this.from.ref) {
            let pseudo = new NodeUI(current, this.from);
            window.MathGraph.all_pseudo.add(pseudo);
            pseudo.html_div.classList.add('refer', 'pseudo');
            current.children.add(pseudo);
            current.child_div.appendChild(pseudo.html_div);
        }
        if(this.alias !== this.from.ref) {
            this.alias.display.to.delete(this.shadow);
            this.shadow.display.from.delete(this.alias);
            this.from.ref.display.to.set(this.shadow, this);
            this.shadow.display.from.set(this.from.ref, this);
            this.alias = this.from.ref;
            this.repr.setOptions({start: this.from.ref});
        }
        current.child_div.appendChild(this.svg);
        this.offset_from = -1;
        this.reposition();
    }
    reposition() {
        if(this.offset_from === -1) {
            this.offset_from = this.offset_to;
            while(this.hierarchy[this.offset_from].parent !== this.alias.parent) this.offset_from++;
        }
        let {choose, socket} = this.get_offset();
        if(choose !== this.offset_to) this.change_to_fit(choose, socket);
        else if(socket !== this.repr.endSocket) this.repr.setOptions({endSocket: socket});
        if(this.is_hidden) return;
        this.repr.position();
        this.adjust_svg();
    }
    change_to_fit(offset, socket) {
        this.remove_from_shadow();
        this.offset_to = offset;
        let next = this.hierarchy[offset];
        let edge = next.display.from.get(this.alias);
        if(!edge) {
            if(!this.repr) {
                this.repr = new LeaderLine(this.alias.html_div, next.html_div, window.MathGraph.edge_opt);
                this.svg = document.body.lastChild;
                this.alias.parent.child_div.appendChild(this.svg);
            }
            next.display.from.set(this.alias, this);
            this.alias.display.to.set(next, this);
            this.repr.setOptions({end: next.html_div, endSocket: socket});
            edge = this;
        }
        if(this !== edge) { document.body.appendChild(this.svg); this.repr.remove(); }
        this.repr = edge.repr;
        this.svg = edge.svg;
        let count = (edge.repr.count = (edge.repr.count ?? 0) + (this.to === next ? 1 : 2));
        let label = count >= 2 ? LeaderLine.captionLabel('+' + (count >> 1), label_opt) : '';
        edge.repr.setOptions({middleLabel: label});
    }
    remove_from_shadow() {
        if(this.repr.count <= 2) {
            this.repr.count = 0;
            this.alias.display.to.delete(this.shadow);
            this.shadow.display.from.delete(this.alias);
        }
        else {
            let label =  (this.repr.count -= 2) == 1 ? '': '+' + (this.repr.count >> 1);
            this.repr.setOptions({middleLabel: label ? LeaderLine.captionLabel(label, label_opt) : ''});
            this.svg = null;
            this.repr = null;
        }
    }
    get_offset() {
        let cur = this.hierarchy[this.offset_from].html_div;
        let render_h = cur.assoc_node.renderer.offsetHeight;
        let [x0, y0, x1, y1] = [0, 0, cur.offsetWidth, cur.offsetHeight - render_h];
        let [dx, dy] = [0, 0];
        let choose = this.offset_from, socket = 'auto';
        for(let i = this.offset_from - 1; i >= 0; i--) {
            cur = this.hierarchy[i].html_div
            dx += cur.offsetLeft - cur.parentNode.scrollLeft;
            dy += cur.offsetTop - cur.parentNode.scrollTop;
            let dy1 = dy + cur.offsetHeight, dx1 = dx + cur.offsetWidth;
            let test = 0, maybe_socket = 'auto';
            if(dx > x1 || dy > y1 || dy1 < y0 || dx1 < x0) break;
            if(dx > x0) { test++; x0 = dx; } else maybe_socket = 'right';
            if(dy > y0) { test++; y0 = dy; } else maybe_socket = 'bottom'; 
            if(dx1 < x1) { test++; x1 = dx1; } else maybe_socket = 'left'; 
            if(dy1 < y1) { test++; y1 = dy1; } else maybe_socket = 'top';
            dy += this.hierarchy[i + 1].renderer.offsetHeight;
            y0 = Math.max(dy, y0);
            if(test < 3) continue;
            socket = maybe_socket;
            choose = i;
            if(!this.hierarchy[i].is_maximize) break;
        }
        return {choose: choose, socket: socket};
    }
    option(opt) {
        this.repr.setOptions(opt);
    }
    /**@param {NodeUI} from @param {NodeUI} to @returns {EdgeUI | string} */
    static create(from, to) {
        let option = window.MathGraph.edge_opt;
        if(option === undefined) option = (window.MathGraph.edge_opt = {path: 'curve', size: 3});
        if(to.is_pseudo) return "can not create edge connect to a pseudo node";
        /** @type {NodeUI}*/
        let actual = from.is_pseudo ? from.ref : from;
        if(NodeUI.lca(actual, to) !== actual.parent) {
            return "can only connect a node to it's sibling's descendant" + (actual !== from ? 
                " (the anchor node is a pseudo node which is not define primarly inside this node)" : "");
        }
        if(actual.type === 'result') return 'can not connect from the conclusion node';
        if(to.type === 'given') return 'can not connect to an input node'
        if(actual.math.to.has(to) || to.math.from.has(actual)) return 'the edge is already connected';
        let edge = new EdgeUI(from, to, option);
        GraphHistory.register('make_edge', {from: from, to: to});
        return edge;
    }
    show(effect) {
        this.repr.show(effect);
    }
    hide(effect) {
        this.repr.hide(effect);
    }
    release_truncate() {

    }
    remove() {
        this.remove_from_shadow();
        if(this.svg) document.body.appendChild(this.svg);
        this.repr?.remove();
        this.from.math.to.delete(this.to);
        for(const parent of this.hierarchy) parent.external_ref.delete(this);
    }
    /**@returns {NodeUI} */
    get shadow() {
        return this.repr.end.assoc_node;
    }
    get stored() {
        return this.alias.parent.child_div;
    }
    get to() {
        return this.hierarchy[0];
    }
    get is_hidden() {
        return this.svg.style.visibility === "hidden";
    }
    /**@param {NodeUI} from @param {NodeUI} to  */
    static reduce(from, to) {

    }
    /**@param {NodeUI} pseudo */
    static reclaim_edges(pseudo, reposition) {
        pseudo.html_div.classList.remove('pseudo');
        if(!hints['refer'].some(hint => pseudo.header.textContent.startsWith(hint))) {
            pseudo.html_div.classList.remove('refer')
        }
        pseudo.html_div.assoc_node = pseudo.ref;
        pseudo.ref.parent.child_div.appendChild(pseudo.html_div);
        for(let [node, edge] of pseudo.display.to) {
            edge.release_truncate();
            pseudo.ref.parent.child_div.appendChild(edge.svg);
            node.display.from.delete(pseudo);
            node.display.from.set(pseudo.ref, edge);
            pseudo.ref.display.to.set(node, edge);
            edge.offset_from = edge.hierarchy.length - 1;
            edge.alias = pseudo.ref;
            if(reposition) edge.reposition();
        }
        window.MathGraph.all_pseudo.delete(pseudo);
        pseudo.parent.children.delete(pseudo);
        if(pseudo.ref.ref == pseudo) pseudo.ref.ref = null;
    }
}
const label_opt = {
    fontFamily: 'serif',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#2edb76',
    outlineColor: ''
}