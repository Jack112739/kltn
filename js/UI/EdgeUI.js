"use strict";
import GraphHistory from './HistoryUI.js';
import NodeUI, {hints} from './NodeUI.js'
import GraphUI from './GraphUI.js';
import Menu from './../editor/Menu.js';

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
        this.offset_to = 0;
        this.offset_from = 0;
        if(!option?.truncate) {
            this.from.math.to.set(to, this);
            to.math.from.set(this.from, this);
        }
        else option.truncate.ref = this;
        from.display.to.set(to, this);
        to.display.from.set(from, this);
        this.hierarchy = [];
        for(let cur = to; cur !== this.from.parent; cur = cur.parent) {
            if(cur.parent === from.parent) this.offset_from = this.hierarchy.length;
            this.hierarchy.push(cur);
            cur.external_ref.add(this);
        }
        if(window.MathGraph.current !== null)  this.init_repr(option);
        //TODO : create some explaination for this (automatically ?)
        this.truncate = option?.truncate ?? null;
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
        if(this.from.is_truncated || this.to === current) return;
        if(this.from.ref && this.from.ref.parent !== current) {
            EdgeUI.reclaim_edges(this.from.ref);
        }
        if(!this.from.ref) EdgeUI.create_pseudo(this.from);
        if(this.alias !== this.from.ref) {
            this.alias.display.to.delete(this.shadow);
            this.shadow.display.from.delete(this.alias);
            this.from.ref.display.to.set(this.shadow, this);
            this.shadow.display.from.set(this.from.ref, this);
            this.alias = this.from.ref;
            this.repr.start = this.from.ref.html_div;
        }
        current.child_div.appendChild(this.svg);
        this.offset_from = -1;
        this.offset_to = 0;
        this.repr.setOptions({end: this.to.html_div, middleLabel: ''});
        this.repr.count = 1;
    }
    init_repr(option) {
        this.repr = new LeaderLine(this.alias.html_div, this.to.html_div, option);
        this.repr.count = 1;
        this.svg = document.body.lastChild;
        this.alias.parent.child_div.appendChild(this.svg);
        this.init_mouse_event();
    }
    reposition() {
        if(!this.repr || this.is_hidden) return;
        if(this.offset_from === -1) {
            this.offset_from = this.offset_to;
            while(this.hierarchy[this.offset_from].parent !== this.alias.parent) this.offset_from++;
        }
        let {choose, socket} = this.get_offset();
        if(choose !== this.offset_to) this.change_to_fit(choose, socket);
        else if(socket !== this.repr.endSocket) this.repr.setOptions({endSocket: socket});
        this.repr.position();
        this.adjust_svg();
    }
    init_mouse_event() {
        let path = this.svg.querySelector('path');
        path.onclick = (e) => {
            e.stopPropagation();
            if(e.ctrlKey) GraphUI.signal(this.release_truncate()); 
        };
        path.oncontextmenu = (e) => { e.preventDefault(); Menu.edge.popup(e, this)};
        path.onmousedown = (e0) => this.change_gravity(e0);
    }
    /**@param {MouseEvent} e  */
    change_gravity(e0) {
        e0.stopPropagation();
        this.reposition();
        let move = null, start = null, end = null;
        let start0 = this.repr.startSocketGravity, end0 = this.repr.endSocketGravity;
        document.addEventListener('mousemove', move = (e) => {
            e.preventDefault();
            if(!start || !end) [start, end] =   [this.alias, this.shadow]
                                                .map(n => n.html_div.getBoundingClientRect())
                                                .map(r => { r.width /= 2; r.height /= 2; return r});
            this.repr.setOptions({
                startSocketGravity: [e.x - start.right, e.y - start.bottom],
                endSocketGravity: [e.x - end.right, e.y - end.bottom],
            });
        })
        document.addEventListener('mouseup', (e) => {
            if(start && end) GraphHistory.register('gravity', {
                from: this.alias, to: this.shadow,
                old_start: start0, old_end: end0,
                start: [e.x - start.right, e.y - start.bottom], end: [e.x - end.right, e.y - end.bottom]
            });
            document.removeEventListener('mousemove', move);
        }, {once: true});
    }
    change_to_fit(offset, socket) {
        this.remove_from_shadow();
        this.offset_to = offset;
        let next = this.hierarchy[offset];
        let edge = next.display.from.get(this.alias);
        if(!edge) {
            if(!this.repr) {
                this.repr = new LeaderLine(this.alias.html_div, next.html_div, window.MathGraph.edge_opt);
                this.repr.setOptions({dash: this.truncate !== null});
                this.svg = document.body.lastChild;
                this.init_mouse_event();
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
            let count = this.repr.count -= 2;
            let label = count < 2 ? '':LeaderLine.captionLabel('+' + (count >> 1), label_opt);
            if(this.repr.count < 2) {
                let is_dash = this.alias.display.to.get(this.shadow).truncate !== null
                this.repr.setOptions({dash: is_dash, middleLabel: ''});
            }
            else this.repr.setOptions({middleLabel: label});
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
    /**@param {NodeUI} from @param {NodeUI} to @returns {EdgeUI | string} */
    static create(from, to) {
        let option = window.MathGraph.edge_opt;
        if(option === undefined) option = (window.MathGraph.edge_opt = {path: 'curve', size: 3});
        if(to.is_pseudo) return "can not create edge connect to a pseudo node";
        /** @type {NodeUI}*/
        let actual = from.is_pseudo ? from.ref : from, current = window.MathGraph.current;
        if(NodeUI.lca(actual, to) !== actual.parent) {
            return "can only connect a node to it's sibling's descendant" + (actual !== from ? 
                " (the anchor node is a pseudo node which is not define primarly inside this node)" : "");
        }
        if(actual.type === 'result') return 'can not connect from the conclusion node';
        if(to.type === 'given') return 'can not connect to an input node'
        if(actual.math.to.has(to) || to.math.from.has(actual)) return 'the edge is already connected';
        if(current && !current.is_ancestor(from)) from = this.create_pseudo(from);
        let edge = new EdgeUI(from, to, option);
        edge.reposition();
        GraphHistory.register('make_edge', {from: actual, to: to, ref: actual.ref !== null});
        return edge;
    }
    show(effect) {
        if(!this.repr) return;
        this.repr.hide('none');
        this.repr.show(effect);
    }
    hide(effect) {
        this.repr.hide(effect);
    }
    release_truncate() {
        if(!this.truncate) return;
        if(!window.MathGraph.current.is_ancestor(this.truncate)) {
            return `fail to remove the truncate, the truncated node ` +
                    `associated with this edge is not a child of the current focusing node`;
        }
        let old = GraphHistory.active;
        GraphHistory.register('release_truncate', {node: this.truncate});
        GraphHistory.active = true;
        this.truncate.ref = null;
        let to_edge = this.truncate.display.to.get(this.to);
        this.truncate.html_div.style.display = "";
        this.to.display.from.set(this.truncate, to_edge);
        to_edge.show('draw');
        to_edge.reposition();
        for(const edge of this.truncate.external_ref) {
            edge.alias.display.to.set(edge.shadow, edge);
            this.alias.parent.child_div.appendChild(edge.svg);
            edge.show('draw');
            edge.reposition();
        }
        this.truncate = null;
        this.remove();
        GraphHistory.active = old;
    }
    remove() {
        if(this.truncate !== null) return this.release_truncate();
        let old = GraphHistory.active;
        GraphHistory.register('remove_edge', {from: this.from, to: this.to, ref: this.from.ref !== null});
        GraphHistory.active = true;
        this.remove_from_shadow();
        if(this.svg) document.body.appendChild(this.svg);
        this.repr?.remove();
        this.from.math.to.delete(this.to);
        this.to.math.from.delete(this.from);
        for(const parent of this.hierarchy) parent.external_ref.delete(this);
        GraphHistory.active = old;
    }
    /**@returns {NodeUI} */
    get shadow() {
        return this.hierarchy[this.offset_to];
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
    /**@param {NodeUI} pseudo */
    static reclaim_edges(pseudo) {
        pseudo.html_div.classList.remove('pseudo');
        if(!hints['refer'].some(hint => pseudo.header.textContent.startsWith(hint))) {
            pseudo.html_div.classList.remove('refer')
        }
        pseudo.html_div.assoc_node = pseudo.ref;
        pseudo.ref.parent.child_div.appendChild(pseudo.html_div);
        for(let [node, edge] of pseudo.display.to) {
            pseudo.ref.parent.child_div.appendChild(edge.svg);
            node.display.from.delete(pseudo);
            node.display.from.set(pseudo.ref, edge);
            pseudo.ref.display.to.set(node, edge);
            edge.offset_from = edge.hierarchy.length - 1;
            edge.alias = pseudo.ref;
        }
        window.MathGraph.all_pseudo.delete(pseudo);
        window.MathGraph.not_rendered.add(pseudo.ref);
        pseudo.parent.children.delete(pseudo);
        if(pseudo.ref.ref == pseudo) pseudo.ref.ref = null;
    }
    static create_pseudo(from) {
        let current = window.MathGraph.current;
        let pseudo = new NodeUI(current, from);
        window.MathGraph.all_pseudo.add(pseudo);
        pseudo.html_div.classList.add('refer', 'pseudo');
        current.children.add(pseudo);
        current.child_div.appendChild(pseudo.html_div);
        return pseudo;
    }
}
const label_opt = {
    fontFamily: 'serif',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#2edb76',
    outlineColor: ''
}
document.addEventListener('DOMContentLoaded', e => {
    Menu.edge = new Menu(document.getElementById('edge'));
    let menu = Menu.edge.items.childNodes;
    menu[HIGHTLIGHT].onclick = e => {
        let target = Menu.edge.associate.repr, default_color = window.MathGraph.edge_opt?.color ?? 'coral';
        if(target.color === default_color) target.setOptions({color: '#81ff93'});
        else target.setOptions({color: default_color});
    }
    menu[TRUNCATE].onclick = e => GraphUI.signal(Menu.edge.associate.release_truncate());
    menu[REMOVE].onclick = e => {
        let edge = Menu.edge.associate;
        if(edge.repr.count > 2) GraphUI.signal('can not remove this edge because this edge is shared among'
                                                + (edge.repr.count >> 1) + 'other edges');
        Menu.edge.associate.remove()
    };

})
const HIGHTLIGHT = 0, TRUNCATE = 1, REMOVE = 2;