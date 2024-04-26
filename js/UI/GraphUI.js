"use strict";

import  NodeUI  from './NodeUI.js';
import EdgeUI from './EdgeUI.js';
import GraphHistory from './HistoryUI.js';
import editor from './../editor/EditorUI.js';
import FileIO from './FileIO.js';
import { map_to_html } from '../editor/Fragment.js';

export default class GraphUI {
    static new_edge(start, e) {
        if(!e) return;
        e.stopPropagation();
        let dot = document.getElementById("dot"), move;
        let viewpoint  = document.documentElement.getBoundingClientRect();
        dot.style.left = `${e.clientX - viewpoint.left}px`;
        dot.style.top = `${e.clientY - viewpoint.top }px`;
        dot.style.display = "block";
        let line = new LeaderLine(start.html_div, dot, {dash: true, path: 'straight', size: 3});
        document.addEventListener('mousemove', move =  e => {
            dot.style.left = `${e.clientX - viewpoint.left}px`;
            dot.style.top = `${e.clientY - viewpoint.top }px`;
            line.position();
        });
        document.addEventListener('click', e => {
            let end = NodeUI.is_node_component(e.target);
            line.remove();
            if(end && end != start && !start.to.has(end) && !end.is_maximize) UI.make_edge(start, end);
            dot.style.display = "none";
            document.removeEventListener('mousemove', move);
        }, {once: true});
    }
    static make_edge(from, to) {

    }
    static get_name() {

    }
    static refresh_href(node) {
        let href = document.getElementById('href');
        href.innerHTML = '';
        for(let cur = node; cur.parent; cur = cur.parent) {
            href.insertAdjacentHTML('afterbegin', `
                <button class="parent">${map_to_html(node.id ? node.id : '..')}</button>
            `);
            href.firstElementChild.onclick = (e) => GraphUI.switch_to(cur);
        }
    }
    /**@param {NodeUI} node */
    static focus(node) {
        let err = node.toggle_detail(true);
        if(err) return UI.signal(err);
        GraphHistory.register('jump', {from: window.MathGraph.current, to: node});
        EdgeUI.toggle_psuedo(node, false, false);
        document.body.replaceChild(window.MathGraph.current.html_div, node.html_div);
        window.MathGraph.current = node;
    }
    static monitor_node_at_cursor(e) {
        if(!e.ctrlKey) return;
        if(window.MathGraph.readonly) return alert("can create or edit node in readonly mode");

        let node = NodeUI.is_node_component(e.target);
        if(!node || node.is_maximize) {
            let parent = node ? node : window.MathGraph.current;
            node = new NodeUI(parent);
            parent.children.add(node);
            parent.child_div.appendChild(node.html_div);
            let rect = parent.child_div.getBoundingClientRect();
            node.html_div.style.left = (e.clientX - rect.x) + "px";
            node.html_div.style.top = (e.clientY - rect.y) + "px";
        }
        editor.load(node);
    }
    static signal(str) {
        if(str) alert(str);
    }
    static configure(option) {

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

        GraphHistory.stack = [];
        GraphHistory.position = 0;
    };
    reader.readAsText(file);
}
async function download(e) {
    let root = window.MathGraph.current, name = null;
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
        await stream.write(FileIO.parse_children(root));
        await stream.close();
        UI.refresh_href();
    } catch(e) {
        if(!(e instanceof DOMException)) return;
        if(e.message.includes('abort')) return;
        UI.signal(`Fail to save your proof${name ? ' into' + name: ''}, reason: ${e.message}`);
    }
}
//setup function
document.addEventListener('DOMContentLoaded', () => {
    window.MathGraph.all_label = new Map();
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