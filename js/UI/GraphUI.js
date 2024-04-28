"use strict";

import  NodeUI  from './NodeUI.js';
import EdgeUI from './EdgeUI.js';
import GraphHistory from './HistoryUI.js';
import editor from './../editor/EditorUI.js';
import FileIO from './FileIO.js';
import { map_to_html } from '../editor/Fragment.js';

export default class GraphUI {
    /**@param {PointerEvent} e @param {NodeUI} start   */
    static new_edge(start, e) {
        if(!e) return;
        e.stopPropagation();
        let dot = document.querySelector(".dot"), prev = null, move = null;
        let viewpoint  = document.documentElement.getBoundingClientRect();
        dot.style.left = `${e.clientX - viewpoint.left}px`;
        dot.style.top = `${e.clientY - viewpoint.top}px`;
        dot.style.display = "block";

        let line = new LeaderLine(start.html_div, dot, {dash: true, path: 'straight', size: 3});
        document.addEventListener('mousemove', move =  (e) => {
            dot.style.left = `${e.clientX - viewpoint.left}px`;
            dot.style.top = `${e.clientY - viewpoint.top }px`;
            line.position();
            let hover = NodeUI.is_node_component(e.target);
            if(hover && hover.is_maximize && !hover.renderer.contains(e.target)) hover = null;
            if(prev !== hover) prev?.toggle_highlight(false);
            hover?.toggle_highlight(true);
            prev = hover;
        });
        document.addEventListener('click', e => {
            let try_edge = prev ? EdgeUI.create(start, prev) : '';
            if(typeof try_edge === "string") this.signal(try_edge);
            line.remove();
            dot.style.display = "none";
            document.removeEventListener('mousemove', move);
        }, {once: true});
    }
    static get_name() {

    }
    /**@param {NodeUI} node  */
    static refresh_href(node) {
        let href = document.getElementById('href');
        href.innerHTML = '';
        for(let cur = node; cur.parent; cur = cur.parent) {
            href.insertAdjacentHTML('afterbegin', `
                <button class="parent">${map_to_html(node.id ? node.id : '..')}</button>
            `);
            href.firstElementChild.onclick = (e) => GraphUI.focus(cur.parent);
        }
    }
    /**@param {NodeUI} node */
    static focus(node) {
        if(node.is_pseudo) node = node.ref;
        let err = node.toggle_detail(true, true), current = window.MathGraph.current;
        if(err) return this.signal(err);
        GraphHistory.register('jump', {from: current, to: node});
        let lca = NodeUI.lca(node, current);
        this.switch_body(lca);
        for(const low of window.MathGraph.all_pseudo) {
            if(NodeUI.lca(lca, low) === lca) EdgeUI.reclaim_edges(low, true);
        }
        this.switch_body(node);
        for(const edge of node.external_ref) edge.refresh();
        this.refresh_href(node);
        node.html_div.style.animation = "focus 0.3s linear";
        node.html_div.addEventListener('animationend', (e) => {
            for(const edge of node.external_ref) { edge.hide('none'); edge.show('draw'); }
        }, {once: true});
    }
    static switch_body(target) {
        let current = window.MathGraph.current;
        target.child_div.style.width = "";
        target.child_div.style.height = "";
        if(current.parent) current.parent.child_div.appendChild(current.html_div);
        else document.body.removeChild(current.html_div);
        document.body.appendChild(target.html_div);
        window.MathGraph.current = target;
    }
    /**@param {PointerEvent} e  */
    static monitor_node_at_cursor(e) {
        if(!e.ctrlKey || editor.div.parentNode.style.display === "block") return;
        if(window.MathGraph.readonly) return alert("can create or edit node in readonly mode");

        let node = NodeUI.is_node_component(e.target);
        if(!node || node.is_maximize) {
            /**@type {NodeUI} */
            let parent = node ? node : window.MathGraph.current;
            node = new NodeUI(parent);
            parent.children.add(node);
            parent.child_div.appendChild(node.html_div);
            let rect = parent.child_div.getBoundingClientRect();
            node.html_div.style.left = (e.clientX - rect.x + parent.child_div.scrollLeft) + "px";
            node.html_div.style.top = (e.clientY - rect.y + parent.child_div.scrollTop) + "px";
        }
        editor.load(node);
    }
    /**@param {String} str  */
    static signal(str) {
        if(str) alert(str);
    }
    static configure(option) {

    }
    /** 
     *  @param {Element | DOMRect} rect
     *  @param {number} x @param {number} y
     *  @param {number?} offset_x @param {number?} offset_y
     */
    static inside_rect(rect, x, y, offset_x, offset_y) {
        if(rect instanceof Element) rect = rect.getBoundingClientRect();
        if(typeof offset_x === 'number') {
            if(offset_x < 0) rect.x = rect.right + offset_x;
            rect.width = Math.abs(offset_x);
        }
        if(typeof offset_y === 'number') {
            if(offset_y < 0) rect.y = rect.bottom + offset_y;
            rect.height = Math.abs(offset_y);
        }
        return rect.x <= x && x <= rect.right && rect.y <= y && y <= rect.bottom;
    }
}
function read_file(e) {
    let file = e.target.files[0];
    let reader = new FileReader();
    reader.onload = (e1) => {
        if(!file.name.endsWith('.tex')) {
            return GraphUI.signal('Can only upload proof stored in .tex file');
        }
        let replace = FileIO.parse_file(e1.target.result, file.name);
        e.target.value = "";
        if(replace instanceof Error) return GraphUI.signal(replace.message);
        window.MathGraph.workspace = file.name;
        GraphUI.switch_body(replace);
        window.MathGraph.current.querySelector('h2').textContent = file.name;
        GraphHistory.stack = [];
        GraphHistory.position = 0;
    };
    reader.readAsText(file);
}
async function download(e) {
    let root = window.MathGraph.current.root, name = null;
    try {
        let file_handler = await window.showSaveFilePicker({
            startIn: FileIO.file_saver,
            suggestedName: `${root.id}.tex`,
            types: [{
                accept: {'text/plain': ['.tex']}
            }]
        });
        FileIO.file_saver = file_handler;
        let stream = await file_handler.createWritable();
        let data = FileIO.parse_graph(root);
        if(data instanceof Error) return GraphUI.signal(data);
        await stream.write(root);
        await stream.close();
        GraphUI.refresh_href();
    } catch(e) {
        if(!(e instanceof DOMException)) return;
        if(e.message.includes('abort')) return;
        GraphUI.signal(`Fail to save your proof${name ? ' into' + name: ''}, reason: ${e.message}`);
    }
}
//setup function
document.addEventListener('DOMContentLoaded', () => {
    window.MathGraph.all_label = new Map();
    window.MathGraph.all_pseudo = new Set();
    GraphHistory.active = true;
    window.MathGraph.current = new NodeUI(null);
    window.MathGraph.current.toggle_detail(true);
    GraphHistory.active = false;
    window.MathGraph.current.html_div.classList.add('playground');
    window.MathGraph.current.child_div.querySelector('h2').textContent = "playground";
    window.MathGraph.current.html_div.style.animation = "";
    document.body.appendChild(window.MathGraph.current.html_div);

    document.addEventListener('click', GraphUI.monitor_node_at_cursor);
    document.querySelector('.undo').onclick = () => GraphHistory.undo();
    document.querySelector('.redo').onclick = () => GraphHistory.redo();

    let input = document.getElementById('uploader');
    document.querySelector('.upload').onclick = () => input.click();
    input.onchange = read_file;
    document.querySelector('.download').onclick = download;
        
});