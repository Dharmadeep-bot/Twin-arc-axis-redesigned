import { useState, useRef, useEffect } from 'react'
import { FileText, Play, RotateCcw, Eye, Table, Layout, X, Layers, Trash2, Download, Loader2, Check, ChevronUp, ChevronDown, Search, UploadCloud, AlertCircle, Info } from 'lucide-react'
import { getBackendConfig } from '../../utils/sharedUtils';

const { API_HOST } = getBackendConfig();

// --- Components ---

const Navbar = ({ activeTab, setActiveTab }) => (
  <nav className="relative h-16 bg-black/40 backdrop-blur-md border-b border-white/5 z-50 flex justify-center">
    <div className="w-full max-w-7xl px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
          <Layout size={24} color="white" />
        </div>
        <span className="font-outfit text-3xl font-black tracking-tighter text-white">
          CAUSAL<span className="text-blue-500">ENGINE</span>
        </span>
      </div>
      
      <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
        <button 
          onClick={() => setActiveTab('runner')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
            activeTab === 'runner' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Play size={16} fill={activeTab === 'runner' ? 'currentColor' : 'none'} /> Causal Runner
        </button>
        <button 
          onClick={() => setActiveTab('viewer')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
            activeTab === 'viewer' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Eye size={16} /> Causal Viewer
        </button>
      </div>

      <div className="w-[140px] hidden md:block"></div>
    </div>
  </nav>
)

const CausalRunner = ({ 
  selection, setSelection, lMin, setLMin, lMax, setLMax, 
  lambda, setLambda,
  startAnalysis, status, error, reset, 
  globalQueue, moveFile, removeFile
}) => {
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files)
    setSelection([...selection, ...newFiles])
  }

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const removeLocalFile = (index) => {
    setSelection(selection.filter((_, i) => i !== index))
  }

  return (
    <div className="flex justify-center w-full pt-12 px-12 pb-24">
      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left Section: Upload & Parameters */}
        <div className="flex-[3] flex flex-col gap-8 w-full">
          <div className="bg-[#0a0a0a] rounded-[40px] p-10 border border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] -mr-32 -mt-32"></div>
            
            <div className="relative z-10 mb-10">
              <h2 className="font-['Outfit'] text-3xl font-black mb-2 text-white tracking-tight uppercase">Configure Analysis</h2>
              <p className="text-gray-500 text-sm font-medium tracking-wide">Upload your datasets and fine-tune causal parameters.</p>
            </div>

            <div 
              onClick={() => status === 'idle' && fileInputRef.current.click()}
              className={`relative z-10 flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-[32px] transition-all duration-500 mb-6 text-center group/drop ${
                status === 'idle' ? 'cursor-pointer border-white/10 hover:border-blue-500/50 hover:bg-blue-600/5' : 'opacity-50 cursor-not-allowed border-white/5'
              }`}
            >
              <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 group-hover/drop:scale-110 group-hover/drop:bg-blue-600 group-hover/drop:text-white shadow-xl shadow-blue-600/5">
                <UploadCloud size={32} />
              </div>
              <div className="font-extrabold text-2xl mb-2 text-white tracking-tight">Drop your CSV or Excel files here</div>
              <div className="text-gray-500 text-sm font-medium">Multiple files supported for batch execution</div>
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".csv,.xlsx,.xls" multiple />
            </div>

            <div className="mb-10 p-4 bg-blue-600/5 border border-blue-500/20 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1 bg-blue-600/20 rounded-md text-blue-400">
                  <Info size={14} />
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Naming Convention Notice</h4>
                  <p className="text-gray-400 text-[11px] leading-relaxed">
                    Upload pattern: <code className="text-blue-300">{"<experiment>__<run>_buc_<window>.csv"}</code><br/>
                    Example: <code className="text-blue-300">hpt__g6r19_buc-late.csv</code>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
              <div className="flex flex-col gap-3">
                <label className="text-[11px] uppercase tracking-[0.2em] font-black text-gray-400 ml-1">L Minimum</label>
                <input 
                  type="number" 
                  className="bg-white/10 border border-white/20 rounded-2xl p-4 !text-white placeholder:text-white font-bold outline-none focus:border-blue-500/50 focus:bg-blue-600/10 transition-all w-full min-h-[56px] appearance-none disabled:opacity-100"
                  placeholder="12"
                  value={lMin} 
                  onChange={(e) => setLMin(parseInt(e.target.value))} 
                  disabled={status !== 'idle'}
                />
              </div>
              <div className="flex flex-col gap-3">
                <label className="text-[11px] uppercase tracking-[0.2em] font-black text-gray-400 ml-1">L Maximum</label>
                <input 
                  type="number" 
                  className="bg-white/10 border border-white/20 rounded-2xl p-4 !text-white placeholder:text-white font-bold outline-none focus:border-blue-500/50 focus:bg-blue-600/10 transition-all w-full min-h-[56px] appearance-none disabled:opacity-100"
                  placeholder="15"
                  value={lMax} 
                  onChange={(e) => setLMax(parseInt(e.target.value))} 
                  disabled={status !== 'idle'}
                />
              </div>
              <div className="flex flex-col gap-3">
                <label className="text-[11px] uppercase tracking-[0.2em] font-black text-gray-400 ml-1">Lambda</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="bg-white/10 border border-white/20 rounded-2xl p-4 !text-white placeholder:text-white font-bold outline-none focus:border-blue-500/50 focus:bg-blue-600/10 transition-all w-full min-h-[56px] appearance-none disabled:opacity-100"
                  placeholder="0.1"
                  value={lambda} 
                  onChange={(e) => setLambda(parseFloat(e.target.value))} 
                  disabled={status !== 'idle'}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                className="flex-1 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 uppercase tracking-wider transition-all shadow-xl shadow-blue-600/20"
                onClick={status === 'completed' ? reset : startAnalysis} 
                disabled={selection.length === 0 || (status !== 'idle' && status !== 'completed' && status !== 'failed')}
              >
                {status === 'completed' ? <><RotateCcw size={20} /> New Session</> : <><Play size={20} fill="currentColor" /> Add to Global Queue</>}
              </button>
              {selection.length > 0 && (
                <button onClick={() => setSelection([])} className="px-6 py-5 bg-white/5 border border-white/10 rounded-2xl text-gray-500 hover:text-red-500 hover:bg-red-500/5 transition-all font-black text-xs uppercase tracking-widest">
                  Clear
                </button>
              )}
            </div>

            {error && (
              <div className="mt-8 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 flex items-center gap-3">
                <AlertCircle size={20} />
                <span className="font-semibold">{error}</span>
              </div>
            )}
            
            {selection.length > 0 && (
               <div className="mt-8 flex flex-col gap-2">
                 <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-3">Local Selection ({selection.length})</h4>
                 {selection.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                      <span className="text-xs font-bold text-gray-400 truncate max-w-[200px]">{f.name}</span>
                      <button onClick={() => removeLocalFile(i)} className="text-gray-600 hover:text-red-500"><X size={14}/></button>
                    </div>
                 ))}
               </div>
            )}
          </div>
        </div>

        {/* Right Section: Batch Status */}
        <div className="flex-1 flex flex-col w-full">
          <div className="bg-[#0a0a0a] rounded-[32px] border border-white/5 shadow-2xl lg:sticky lg:top-8 max-h-[calc(100vh-160px)] flex flex-col">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-blue-500" />
                <h3 className="font-bold uppercase tracking-widest text-xs text-white">Batch Queue</h3>
              </div>
              <span className="bg-white/5 px-3 py-1 rounded-full text-[10px] font-black text-gray-400">
                {globalQueue.length} TASKS
              </span>
            </div>

            <div className="p-6 flex flex-col gap-4 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {globalQueue.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center opacity-20">
                  <FileText size={48} className="mb-4" />
                  <p className="text-sm font-bold uppercase text-white">Queue is empty</p>
                </div>
              ) : (
                globalQueue.map((item, idx) => {
                  return (
                    <div key={item.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                      item.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/20' :
                      item.status === 'processing' ? 'bg-blue-600/5 border-blue-600/30' :
                      'bg-white/2 border-white/5'
                    }`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] border ${
                        item.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                        item.status === 'processing' ? 'bg-blue-600/10 border-blue-600/20 text-blue-500' :
                        'bg-white/5 border-white/10 text-gray-500'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-bold truncate ${item.status === 'completed' ? 'text-emerald-400' : 'text-gray-300'}`}>
                          {item.name}
                        </div>
                        <div className="text-[10px] text-gray-600 font-medium lowercase">
                          {formatSize(item.size)} • {item.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {item.status === 'pending' && (
                          <div className="flex flex-col gap-0.5">
                              <button 
                                onClick={() => moveFile(item.id, 'up')}
                                disabled={idx === 0 || globalQueue[idx-1].status !== 'pending'}
                                className="p-1 text-gray-600 hover:text-white hover:bg-white/5 rounded disabled:opacity-0"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button 
                                onClick={() => moveFile(item.id, 'down')}
                                disabled={idx === globalQueue.length - 1 || globalQueue[idx+1].status !== 'pending'}
                                className="p-1 text-gray-600 hover:text-white hover:bg-white/5 rounded disabled:opacity-0"
                              >
                                <ChevronDown size={14} />
                              </button>
                          </div>
                        )}
                        
                        {item.status === 'processing' && (
                           <Loader2 size={16} className="text-blue-500 animate-spin mr-2" />
                        )}
                        {item.status === 'completed' && (
                           <Check size={16} className="text-emerald-500 mr-2" />
                        )}
                        {item.status === 'failed' && (
                           <AlertCircle size={16} className="text-red-500 mr-2" title={item.error} />
                        )}

                        <button 
                          onClick={() => removeFile(item.id)}
                          className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remove from queue"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {globalQueue.some(i => i.status === 'processing') && (
              <div className="p-6 bg-white/[0.02] border-t border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Global Status</span>
                  <span className="text-sm font-black text-blue-500">Processing {globalQueue.find(i => i.status === 'processing')?.name}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const CausalViewer = () => {
  const [outputs, setOutputs] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileData, setFileData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchOutputs = async () => {
    try {
      const response = await fetch(`${API_HOST}/api/causal/outputs`)
      const data = await response.json()
      setOutputs(data)
    } catch (err) {
      console.error("Failed to fetch outputs", err)
    }
  }

  useEffect(() => {
    fetchOutputs()
  }, [])

  const viewFileData = async (filename) => {
    setLoading(true)
    setSelectedFile(filename)
    try {
      const response = await fetch(`${API_HOST}/api/causal/output-data/${filename}`)
      const data = await response.json()
      setFileData(data)
    } catch (err) {
      console.error("Failed to fetch file data", err)
    } finally {
      setLoading(false)
    }
  }

  const deleteFile = async (e, filename) => {
    e.stopPropagation()
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return
    
    try {
      const response = await fetch(`${API_HOST}/api/causal/output/${filename}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchOutputs()
        if (selectedFile === filename) setSelectedFile(null)
      }
    } catch (err) {
      console.error("Failed to delete file", err)
    }
  }

  const downloadFile = (e, filename) => {
    e.stopPropagation()
    window.open(`${API_HOST}/api/causal/download/${filename}`, '_blank')
  }

  const filteredOutputs = outputs.filter(out => 
    out.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex justify-center w-full pt-12 px-12 pb-24">
      <div className="w-full max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="flex-1">
            <h2 className="font-['Outfit'] text-4xl font-black mb-2 text-white uppercase tracking-tight">Causal Results</h2>
            <p className="text-gray-500 font-medium text-sm mb-6">Review datasets and causal metrics from successful runs.</p>
            
            <div className="relative max-w-md group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition-opacity duration-500"></div>
              <div className="relative flex items-center bg-[#0c0c0c] border border-white/10 rounded-2xl focus-within:border-blue-500/50 transition-all duration-300">
                <div className="pl-4 text-gray-500 group-focus-within:text-blue-500 transition-colors">
                  <Search size={18} />
                </div>
                <input 
                  type="text"
                  placeholder="Filter by run name..."
                  className="w-full bg-transparent border-none py-3.5 pl-3 pr-4 outline-none text-white placeholder:text-white/40 font-medium text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          <button className="h-14 px-6 bg-white/5 border border-white/5 rounded-2xl text-gray-400 font-bold flex items-center gap-2 hover:bg-white/10 hover:text-blue-500 transition-all active:scale-95" onClick={fetchOutputs}>
             <RotateCcw size={18} /> Sync Library
          </button>
        </div>
        
        {filteredOutputs.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-20 bg-white/[0.02] border border-white/5 rounded-[40px]">
            <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 text-gray-700">
              <FileText size={40} />
            </div>
            <p className="text-gray-500 font-medium text-lg text-center">No results match your search or the library is empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOutputs.map((out) => (
              <div 
                key={out.name}
                onClick={() => viewFileData(out.name)}
                className="group bg-[#0c0c0c] border border-white/5 rounded-3xl p-5 cursor-pointer transition-all duration-300 relative overflow-hidden hover:border-blue-500/40 hover:-translate-y-1 shadow-lg"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 bg-blue-600/10 text-blue-500 border border-blue-600/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText size={20} />
                  </div>
                  <div className="flex gap-1.5 translate-x-1">
                    <button 
                      onClick={(e) => downloadFile(e, out.name)}
                      className="p-2.5 rounded-lg bg-white/5 text-gray-500 hover:bg-blue-600/20 hover:text-blue-400 transition-all"
                      title="Download"
                    >
                      <Download size={15} />
                    </button>
                    <button 
                      onClick={(e) => deleteFile(e, out.name)}
                      className="p-2.5 rounded-lg bg-white/5 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-sm mb-2 text-white line-clamp-2 min-h-[2.5rem] leading-tight uppercase group-hover:text-blue-400 transition-colors" title={out.name}>
                  {out.name.replace(/_B_Matrix_\d+/, '').replace('.xlsx', '')}
                  <span className="text-blue-500/40 ml-1">.xlsx</span>
                </h3>
                
                <div className="flex items-center gap-2 text-[9px] font-black tracking-widest mb-6 text-gray-600 uppercase">
                  <span className="bg-white/5 px-2 py-0.5 rounded-md">{(out.size / 1024).toFixed(0)} KB</span>
                  <span className="bg-white/5 px-2 py-0.5 rounded-md">{new Date(out.modified * 1000).toLocaleDateString()}</span>
                </div>
                
                <button className="w-full bg-white/5 border border-white/5 text-gray-400 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-600/20">
                  Inspect Run
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedFile && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col p-6 md:p-12">
            <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-5 font-['Outfit']">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 text-white">
                    <Table size={24} />
                  </div>
                  <div>
                      <h3 className="text-2xl font-black leading-tight tracking-tight uppercase text-white">{selectedFile}</h3>
                      <p className="text-gray-500 text-sm font-medium">Dataset preview & matrix view</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={(e) => downloadFile(e, selectedFile)}
                    className="px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                  >
                    <Download size={20} /> Download XLSX
                  </button>
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="w-14 h-14 bg-white/5 text-gray-400 rounded-full flex items-center justify-center hover:bg-white/10 hover:text-white transition-all active:scale-95"
                  >
                    <X size={28} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto bg-[#0a0a0a] border border-white/10 rounded-[40px] shadow-2xl relative scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                     <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-500 rounded-full animate-spin mb-6"></div>
                     <span className="font-bold tracking-widest text-xs uppercase">Hydrating Data Components</span>
                  </div>
                ) : fileData ? (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          {fileData.columns.map(col => (
                            <th key={col} className="p-5 px-8 text-left text-[11px] font-black text-blue-500/70 uppercase tracking-[0.2em] bg-[#111] border-b border-white/10 whitespace-nowrap sticky top-0">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fileData.data.map((row, i) => (
                          <tr key={i} className="border-b border-white/[0.03] hover:bg-blue-600/[0.02] transition-colors group">
                            {row.map((cell, j) => (
                              <td key={j} className="p-5 px-8 text-sm font-medium text-gray-400 whitespace-nowrap group-hover:text-white transition-colors">
                                {typeof cell === 'number' ? 
                                  (Math.abs(cell) < 0.0001 && cell !== 0 ? cell.toExponential(2) : cell.toFixed(5)) 
                                  : cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-red-500 p-20">
                    <AlertCircle size={48} />
                    <span className="font-bold mt-4">Encryption/Parsing Error: Failed to resolve dataset</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CausalAnalysis() {
  const [activeTab, setActiveTab] = useState('runner')
  
  // Local Selection State (before being added to global queue)
  const [selection, setSelection] = useState([])
  const [globalQueue, setGlobalQueue] = useState([])
  
  const [lMin, setLMin] = useState(12)
  const [lMax, setLMax] = useState(15)
  const [lambda, setLambda] = useState(0.1)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const response = await fetch(`${API_HOST}/api/causal/queue`)
        const data = await response.json()
        setGlobalQueue(data)
      } catch (err) { console.error("Poll failed", err) }
    }
    fetchQueue()
    const interval = setInterval(fetchQueue, 2000)
    return () => clearInterval(interval)
  }, [])

  const startAnalysis = async () => {
    if (selection.length === 0) return
    
    setStatus('uploading')
    setError('')

    const formData = new FormData()
    selection.forEach(f => formData.append('files', f))
    formData.append('Lmin', lMin)
    formData.append('Lmax', lMax)
    formData.append('lamda', lambda)

    try {
      const response = await fetch(`${API_HOST}/api/causal/analyze-batch`, { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Upload failed')
      setSelection([]) // Clear selection once added to server
      setStatus('idle')
    } catch (err) {
      setStatus('failed')
      setError(err.message)
    }
  }

  const reset = () => {
    setStatus('idle')
    setError('')
    setSelection([])
  }

  const removeFile = async (itemId) => {
    try {
      await fetch(`${API_HOST}/api/causal/queue/${itemId}`, { method: 'DELETE' })
    } catch (err) { console.error(err) }
  }

  const moveFile = async (itemId, direction) => {
    const formData = new FormData()
    formData.append('item_id', itemId)
    formData.append('direction', direction)
    try {
      await fetch(`${API_HOST}/api/causal/queue/move`, { method: 'POST', body: formData })
    } catch (err) { console.error(err) }
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      {activeTab === 'runner' ? (
        <CausalRunner 
          selection={selection} setSelection={setSelection} lMin={lMin} setLMin={setLMin} 
          lMax={lMax} setLMax={setLMax} lambda={lambda} setLambda={setLambda} 
          startAnalysis={startAnalysis} status={status} 
          error={error} reset={reset}
          globalQueue={globalQueue} moveFile={moveFile} removeFile={removeFile}
        />
      ) : (
        <CausalViewer />
      )}
    </div>
  )
}

export default CausalAnalysis
