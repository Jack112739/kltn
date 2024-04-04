class Parser {

}

document.addEventListener('DOMContentLoaded', () => {
    let button = document.getElementById('uploader');
    let input = document.getElementById('upload');
    let cf = document.getElementById('confirm');
    button.onclick = (e) => input.click();
    input.onchange = (e) => {
        button.innerText = input.files[0].name;
    };
    cf.onclick = (e) => {
        if(input.files.length === 0) return alert('no file were chosen');
        
    }
})