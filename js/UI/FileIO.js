"use strict";

import Fragment from './../editor/Fragment.js';
import NodeUI from './NodeUI.js';
import GraphHistory from './HistoryUI.js';
import GraphUI from './GraphUI.js';

export default class FileIO {
    /** @param {NodeUI} node @returns {String} */
    static to_file(node) {
        
    }
    static parse_file(str, file_name) {
        let lines = str.split('\n');
        let cur = null, err_msg = null, now = null;
        let implicit_id = new Map();
        GraphHistory.active = true;
        cur = new NodeUI(null);
        cur.rename(remove_ext(file_name));
        window.MathGraph.all_label = new Map();
        parse:
        for(let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if(line.startsWith('%%')) {
                now = new NodeUI(cur);
                implicit_id.set(i, now);
                let headers = line.slice(2).split(',').map(str => str.trim());
                let implicit_start = 5;
                let test = now.rename(headers[0]);
                if(test) {
                    err_msg = `error at line ${i}: ${test}`;
                    break parse;
                }
                try {
                    now.html_div.style.top = parse_int_px(headers[1], 1);
                    now.html_div.style.left = parse_int_px(headers[2], 2);
                    now.renderer.style.height = parse_int_px(headers[3], 3);
                    now.renderer.style.width = parse_int_px(headers[4], 4);
                } catch(e) {
                    implicit_start = e;
                }
                for(let j = implicit_start; j < headers.length; j++) {
                    if(headers[j] === '') continue;
                    if(headers[j].startsWith('#')) test = FileIO.link(now, headers, j, implicit_id);
                    else test = now.reference(headers[j]);
                    if(test) {
                        err_msg = `error at line ${i}: ${test}`;
                        break parse;
                    }
                }
            }
            else if(line === '\\begin{proof}') {
                if(!now) {
                    err_msg = `error at line ${i}: exptected the %% comment at the begining of a node`;
                    break parse;
                }
                now.raw_text = now.raw_text.trim();
                if(now.raw_text.startsWith('\\begin{lemma}')) {
                    if(!now.raw_text.endsWith('\\end{lemma}')) {
                        err_msg = `error at line ${i}: missing \\end{lemma}`;
                        break parse;
                    }
                    now.raw_text = now.raw_text.slice('\\begin{lemma}'.length, -'\\end{lemma}'.length);
                }
                cur = now;
                now = null;
            }
            else if(line === '\\end{proof}') {
                cur = cur.parent;
                now = null;
            }
            else {
                if(line.length === 0) continue;
                if(!now) {
                    err_msg = `error at line ${i}: exptected the %% comment at the begining of a node`;
                    break parse;
                }
                now.raw_text += '\n';
                now.raw_text += line;
            }
        }
        if(cur.parent && !err_msg) err_msg = `missing \\end{proof} at the and of the file`;
        if(err_msg) return new Error(err_msg);
        FileIO.compile(cur);
        GraphHistory.active = false;
        return cur;
    }
    static compile(node) {
        for(const [_, child] of node.children) FileIO.compile(child);
        let data = (new Fragment(node.raw_text, 'text')).output('html');
        for(const child of data) node.html_div.appendChild(child);
    }
    static link(now, args, id, implicit_id) {
        if(isNaN(args[id].slice(1))) return `invalid syntax, expect the ${id}-th arguement`
                                        + `to be a valid reference or a '#' follow by a number`;
        let line = parseInt(args[id].slice(1));
        let node = implicit_id.get(line);
        if(!node) return `can not reference to node at line ${line}`
                        + `because there are no node's comment (start with %%) at that line`;
        return now.reference(node);

    }
    static file_saver;
}
function parse_int_px(str, i) {
    if(isNaN(str)) throw i;
    return str.trim() + "px";
}
function remove_ext(name) {
    return name.split('.').slice(0, -1).join('');
}