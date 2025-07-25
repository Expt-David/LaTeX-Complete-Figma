import * as React from 'react';
const mathjax = require('mathjax-full/js/mathjax.js').mathjax;
const TeX = require('mathjax-full/js/input/tex.js').TeX;
const SVG = require('mathjax-full/js/output/svg.js').SVG;
const liteAdaptor = require('mathjax-full/js/adaptors/liteAdaptor.js').liteAdaptor;
const RegisterHTMLHandler = require('mathjax-full/js/handlers/html.js').RegisterHTMLHandler;
const AllPackages = require('mathjax-full/js/input/tex/AllPackages.js').AllPackages;
import AceEditor from 'react-ace';

import 'ace-builds/src-noconflict/mode-latex';
import 'ace-builds/src-noconflict/theme-textmate';
import 'ace-builds/src-noconflict/ext-searchbox';
import langTools from 'ace-builds/src-noconflict/ext-language_tools';
import '../styles/ui.css';

import symbols from '../../symbols.json';
import {Range} from 'ace-builds';

declare function require(path: string): any;

const App = ({}) => {
    const [convert, setConvert] = React.useState(null);
    const [currentScale, setCurrentScale] = React.useState(1);
    const [isUpdating, setIsUpdating] = React.useState(false);
    // const [debugInfo, setDebugInfo] = React.useState(null);

    React.useEffect(() => {
        // https://github.com/mathjax/MathJax-demos-node/blob/master/direct/tex2svg
        const adaptor = liteAdaptor();
        RegisterHTMLHandler(adaptor);
        const tex = new TeX({packages: AllPackages});
        const svg = new SVG({fontCache: 'none'});
        const html = mathjax.document('', {InputJax: tex, OutputJax: svg});
        const cv = (input: string) => {
            const node = html.convert(input, {});
            return adaptor.innerHTML(node);
        };
        setConvert(() => cv);
        onmessage = event => {
            const msg = event.data.pluginMessage;
            switch (msg.type) {
                case 'source':
                    setCode(msg.value);
                    if (msg.scale && msg.scale !== 1) {
                        setCurrentScale(msg.scale);
                        setIsUpdating(true);
                    }
                    break;
                case 'generate-for-scale-detection':
                    setCode(msg.source);
                    setIsUpdating(true);
                    // Generate fresh SVG and send it to Figma to create actual group for comparison
                    const freshSvg = cv(msg.source);
                    parent.postMessage(
                        {
                            pluginMessage: {
                                type: 'generate-for-scale-detection',
                                svg: freshSvg,
                                source: msg.source,
                                currentWidth: msg.currentWidth,
                                currentHeight: msg.currentHeight,
                            },
                        },
                        '*'
                    );
                    break;
                case 'scale-detected':
                    // Receive the scale detected by comparing Figma groups
                    console.log('Scale detected from Figma group comparison:', msg.scale);
                    // setDebugInfo(msg.debug);
                    if (Math.abs(msg.scale - 1) > 0.01) {
                        setCurrentScale(msg.scale);
                    } else {
                        setCurrentScale(1);
                    }
                    break;
            }
        };
    }, []);

    const [code, setCode] = React.useState('');
    const [preview, setPreview] = React.useState('');

    const onChange = React.useCallback(
        (value: string) => {
            setCode(value);
            setPreview(convert(value));
        },
        [convert]
    );
    const onCreate = React.useCallback(() => {
        // const count = parseInt(textbox.current.value, 10);
        const node = convert(code);
        // Use the existing scale if updating, otherwise use default scale of 3
        const scaleToUse = isUpdating ? currentScale : 3;
        parent.postMessage(
            {pluginMessage: {type: 'create-latex-svg', svg: node, source: code, scale: scaleToUse}},
            '*'
        );
    }, [convert, code, currentScale, isUpdating]);

    const onCancel = React.useCallback(() => {
        parent.postMessage({pluginMessage: {type: 'cancel'}}, '*');
    }, []);

    const onLoad = React.useCallback(() => {
        langTools.setCompleters([
            {
                // @ts-ignore
                getCompletions: (e, session, pos, prefix, cb) => {
                    if (prefix.length === 0) {
                        cb(null, []);
                        return;
                    }
                    const preceding = session.getTextRange(new Range(pos.row, pos.column - 2, pos.row, pos.column - 1));
                    const filtered = symbols
                        .filter((symbol: string) => symbol.includes(prefix))
                        .map((symbol: string) => ({
                            caption: symbol,
                            value: preceding === '\\' ? symbol.substring(1) : symbol,
                            meta: 'LaTeX',
                        }));
                    cb(null, filtered);
                },
                activated: true,
            },
        ]);
    }, []);

    return (
        <div>
            <AceEditor
                mode="latex"
                theme="textmate"
                onChange={onChange}
                value={code}
                width="100%"
                height="80px"
                showGutter={false}
                focus={true}
                wrapEnabled={true}
                onLoad={onLoad}
                enableBasicAutocompletion={false}
                enableLiveAutocompletion={true}
                placeholder="Type your math-mode LaTeX here..."
            />
            <div
                style={{
                    height: '120px',
                    width: '100%',
                    border: '1px solid gray',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'auto',
                    fontSize: '18px',
                }}
                dangerouslySetInnerHTML={{__html: preview}}
            />
            {isUpdating && (
                <div style={{padding: '5px', fontSize: '12px', color: '#666', textAlign: 'center'}}>
                    Updating existing element (Scale: {currentScale.toFixed(2)}x)
                </div>
            )}
            {/* {debugInfo && (
                <div style={{
                    padding: '8px', 
                    fontSize: '11px', 
                    backgroundColor: '#f0f0f0', 
                    border: '1px solid #ccc',
                    marginTop: '5px',
                    fontFamily: 'monospace'
                }}>
                    <div><strong>Scale Detection Debug:</strong></div>
                    <div>Current: {debugInfo.currentWidth}×{debugInfo.currentHeight}</div>
                    <div>Fresh: {debugInfo.freshWidth.toFixed(1)}×{debugInfo.freshHeight.toFixed(1)}</div>
                    <div>Scale X: {debugInfo.scaleX.toFixed(3)}, Y: {debugInfo.scaleY.toFixed(3)}</div>
                    <div>Detected Scale: {debugInfo.detectedScale.toFixed(3)}</div>
                </div>
            )} */}
            <div style={{paddingTop: '10px'}}>
                <button className="primary" onClick={onCreate}>
                    {isUpdating ? 'Update' : 'Create'}
                </button>
                <button onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
};

export default App;
