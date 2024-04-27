"use strict";
import GraphHistory from './HistoryUI.js';
import NodeUI from './NodeUI.js'

export default class EdgeUI {

    /**@type {LeaderLine>} */
    repr;
    /**@type {NodeUI} the parent of where this node was stolen from */
    from;
    /**@type {NodeUI} */
    to;
    /**@type {NodeUI?} appear when we want to shorten the proof this is a singly linked list*/
    truncate;
    /**@type {SVGElement} */
    svg;

    constructor(from, to, option) {
        this.from = from.is_pseudo ? from.from : from;
        this.to = to;
        this.repr = new LeaderLine(from.html_div, to.html_div, option);
        this.svg = document.body.lastChild;
        this.adjust_svg();
        //TODO : create some explaination for this
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
    /**@param {boolean} external */
    reposition(external) {
        this.repr.position();
        this.adjust_svg();
        if(!external) return;
    }
    option(opt) {
        this.repr.option(opt);
    }
    /**@param {NodeUI} from @param {NodeUI} to @returns {EdgeUI | string} */
    static create(from, to, option) {
        if(option === undefined) option = {path: 'curve', size: 3}
        if(to.is_pseudo) return "can not create edge connect to a pseudo node";
        /** @type {NodeUI}*/
        let actual = from.is_pseudo ? from.from : from;
        if(!actual.parent.child_div.contains(to.child_div) || actual.html_div.contains(to.child_div)) {
            return "can only connect a node to it's sibling's descendant";
        }
        if(actual.type === 'result') return 'can not connect from the conclusion node';
        if(to.type === 'given') return 'can not connect to an input node'
        if(actual.to.has(to) || to.from.has(actual)) return 'the edge is already connected';
        let edge = new EdgeUI(from, to, option);
        from.parent.child_div.appendChild(edge.svg);
        from.to.set(to, edge);
        to.from.set(actual, edge);
        for(let cur = to.parent; cur !== actual.parent; cur = to.parent) {
            cur.external_ref.add(edge);
        }
        GraphHistory.register('make_edge', {from: from, to: to});
        return edge;
    }
    show(effect) {
        this.repr.show(effect);
    }
    hide(effect) {
        this.parent.hide(effect);
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
}