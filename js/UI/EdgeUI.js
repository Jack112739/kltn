"use strict";
import GraphHistory from './HistoryUI.js';
import NodeUI, {hints} from './NodeUI.js'
import GraphUI from './GraphUI.js';

export default class EdgeUI {

    /**@type {LeaderLine>} */
    repr;
    /**@type {NodeUI} the parent of where this node was stolen from */
    from;
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
    /**@type {EdgeUI}*/
    next = null; 
    /**@type {EdgeUI} */
    prev = null;

    /**@param {NodeUI} from @param {NodeUI} to */
    constructor(from, to, option) {
        this.from = from.is_pseudo ? from.ref : from;
        this.hierarchy = [to];
        this.repr = new LeaderLine(from.html_div, to.html_div, option);
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
        let alias = this.alias;
        if(!this.from.ref) {
            let pseudo = new NodeUI(current, this.from);
            pseudo.html_div.classList.add('refer', 'pseudo');
            current.children.add(pseudo);
            current.child_div.appendChild(pseudo.html_div);
        }
        if(alias !== this.from.ref) {
            alias.display.to.delete(this.shadow);
            this.shadow.display.from.delete(alias);
            this.from.ref.display.to.set(this.shadow, this);
            this.shadow.display.from.set(this.shadow, this)
            this.repr.setOptions({start: this.from.ref});
        }
        current.child_div.appendChild(this.svg);
        this.offset_from = -1;
        this.reposition();
        this.repr.hide("none");
        setTimeout(() => this.repr.show('draw'), 320);
    }
    reposition() {
        if(this.offset_from === -1) {
            this.offset_from = this.offset_to;
            while(this.hierarchy[this.offset_from + 1] !== this.alias.parent) this.offset_from++;
        }
        let cur = this.hierarchy[this.offset_from].html_div;
        let [w0, h0] = [cur.offsetWidth, cur.offsetHeight];
        let choose = this.offset_from, socket = 'auto';
        let rect = new DOMRect(0, 0, cur.offsetHeight, cur.offsetWidth);
        for(let i = this.offset_from - 1; i >= 0; i--) {
            cur = this.hierarchy[i].html_div;
            rect.x += cur.offsetLeft - cur.parentNode.scrollLeft;
            rect.y += cur.offsetTop - cur.parentNode.scrollTop;
            rect.width = cur.offsetWidth;
            rect.height = cur.offsetHeight;
            if(rect.x >= w0 || rect.right <= 0 || rect.y >= h0 || rect.bottom <= 0) break;
            else if(rect.x > 0 && rect.right < w0 && rect.y > 0) socket = 'top';
            else if(rect.x > 0 && rect.right < w0 && rect.bottom < h0) socket = 'bottom';
            else if(rect.y > 0 && rect.bottom < h0 && rect.x > 0) socket = 'left';
            else if(rect.y > 0 && rect.bottom < h0 && rect.right < w0) socket = 'right';
            else continue;
            choose = i;
            if(!cur.assoc_node.is_maximize) break;
        }
        if(choose !== this.offset_to) this.change_to_fit(choose, socket);
        if(socket !== this.repr.endSocket) this.repr.setOptions({endSocket: socket});
        if(this.is_hidden) return;
        this.repr.position();
        this.adjust_svg();
    }
    change_to_fit(offset, socket) {
        this.remove_from_shadow();
        let next = this.hierarchy[offset];
        let cur = this.alias.display.to.get(next);
        if(cur) {
            let count = parseInt(cur.repr.middleLabel.text.slice(1));
            this.hide('none');
            this.prev = cur;
            this.next = cur.next;
            if(cur.next) cur.next.prev = this;
            cur.next = this;
            cur.setOptions({ middleLabel: '+' + (count + 1)});
        }
        else {
            this.alias.display.to.set(next, this);
            next.display.from.set(this.alias, this);
            if(!next.is_maximize) this.repr.setOptions({middleLabel: ''});
            else this.repr.setOptions({end: next.html_div, endSocket: socket,
                middleLabel: LeaderLine.captionLabel('+1', {
                    outlineColor: '',
                    fontFamily: 'sans-serif',
                    fontSize: '16px',
                    color: '#2edb76',
                })
            })
        }
        this.offset_to = offset;
    }
    remove_from_shadow() {
        let edge = this.alias.display.to.get(this.shadow);
        let count_str = edge?.repr.middleLabel.text, count = 0;
        if(!count_str || (count = parseInt(count_str.slice(1))) === 1) {
            edge?.repr.setOptions({middleLabel: ""});
            this.shadow.display.from.delete(this.alias);
            this.alias.display.to.delete(this.shadow);
            return;
        }
        if (this === edge) {
            this.shadow.display.from.set(this.alias, this.next);
            this.alias.display.to.set(this.shadow, this.next);
            this.next.prev = null;
            this.next.repr.setOptions({
                middleLabel: LeaderLine.captionLabel('+' + (count - 1), {
                    outlineColor: '',
                    fontFamily: 'sans-serif',
                    fontSize: '16px',
                    color: '#2edb76',
                })
            });
        }
        else {
            this.prev.next = this.next;
            if(this.next) this.next.prev = this.prev;
            this.repr.setOptions({middleLabel: '+' + (count - 1)});
        }
        this.next = null;
        this.prev = null;
    }
    option(opt) {
        this.repr.setOptions(opt);
    }
    /**@param {NodeUI} from @param {NodeUI} to @returns {EdgeUI | string} */
    static create(from, to, option) {
        if(option === undefined) option = {path: 'curve', size: 3}
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
        this.parent.hide(effect);
    }
    release_truncate() {

    }
    remove() {
        this.repr.remove();
        this.svg = null;
    }
    /**@returns {NodeUI} */
    get alias() {
        return this.repr.start.assoc_node;
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
    static reclaim_edges(pseudo) {
        pseudo.html_div.classList.remove('pseudo');
        if(!hints['refer'].some(hint => pseudo.header.textContent.startsWith(hint))) {
            pseudo.html_div.classList.remove('refer')
        }
        pseudo.ref.parent.child_div.appendChild(pseudo.html_div);
        for(let [_, edge] of pseudo.to) {
            edge.release_truncate();
            edge.shadow.display.from.remove(edge.alias);
            edge.alias.display.to.remove(edge.shadow);
            edge.repr.setOptions({start: pseudo.from.html_div});
            edge.offset_from = edge.hierarchy.length - 1;
        }
        pseudo.parent.children.delete(pseudo);
        if(pseudo.from.ref == pseudo) pseudo.from.ref = null;
    }
}