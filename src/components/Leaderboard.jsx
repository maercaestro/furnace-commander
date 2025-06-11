import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function Leaderboard() {
  const navigate = useNavigate()
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortBy, setSortBy] = useState('score') // Default sort by score
  const [sortOrder, setSortOrder] = useState('desc') // Default descending order
  const [limit, setLimit] = useState(20) // Show more entries on dedicated page

  useEffect(() => {
    fetchLeaderboard()
  }, [sortBy, sortOrder, limit])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .limit(limit)
      
      if (error) {
        throw new Error(error)
      }
      
      setLeaderboard(data || [])
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      setError('Failed to load leaderboard data. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (column) => {
    if (sortBy === column) {
      // If already sorting by this column, toggle order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, set as default desc order
      setSortBy(column)
      setSortOrder('desc') 
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-4xl mx-auto p-3 sm:p-8">
        <header className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-3 sm:p-6 mb-4 sm:mb-8 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <h3 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            Furnace Commander Leaderboard
          </h3>
          <button
            className="!bg-white/20 backdrop-blur-sm !text-white px-3 sm:px-4 py-2 rounded-xl hover:bg-white/30 text-sm sm:text-base border border-white/30"
            onClick={() => navigate('/')}
          >
            ← Back to Game
          </button>
        </header>
        <main>
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-4 sm:p-8 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Furnace Commander Leaderboard</h2>
              <select
                className="px-3 py-1 border text-white border-gray-300 rounded text-sm sm:text-base w-full sm:w-auto"
                onChange={(e) => setLimit(Number(e.target.value))}
                value={limit}
              >
                <option value={20}>Top 20</option>
                <option value={50}>Top 50</option>
                <option value={100}>Top 100</option>
              </select>
            </div>

            {loading ? (
              <div className="text-center p-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading scores...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-lg text-center text-red-600">
                {error}
              </div>
            ) : leaderboard.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[500px]">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 sm:px-4 py-3 text-left text-sm sm:text-base">#</th>
                      <th 
                        className="px-2 sm:px-4 py-3 text-left cursor-pointer hover:bg-gray-200 text-sm sm:text-base"
                        onClick={() => handleSort('player_name')}
                      >
                        <div className="flex items-center">
                          Player
                          {sortBy === 'player_name' && (
                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-2 sm:px-4 py-3 text-right cursor-pointer hover:bg-gray-200 text-sm sm:text-base"
                        onClick={() => handleSort('score')}
                      >
                        <div className="flex items-center justify-end">
                          Score
                          {sortBy === 'score' && (
                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-2 sm:px-4 py-3 text-center cursor-pointer hover:bg-gray-200 text-sm sm:text-base"
                        onClick={() => handleSort('grade')}
                      >
                        <div className="flex items-center justify-center">
                          Grade
                          {sortBy === 'grade' && (
                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="hidden sm:table-cell px-2 sm:px-4 py-3 text-right cursor-pointer hover:bg-gray-200 text-sm sm:text-base"
                        onClick={() => handleSort('created_at')}
                      >
                        <div className="flex items-center justify-end">
                          Date
                          {sortBy === 'created_at' && (
                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => (
                      <tr key={entry.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 border-t border-gray-200`}>
                        <td className="px-2 sm:px-4 py-3 text-gray-800 text-sm sm:text-base">{index + 1}</td>
                        <td className="px-2 sm:px-4 py-3 font-medium text-gray-800 text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">{entry.player_name}</td>
                        <td className="px-2 sm:px-4 py-3 text-right font-medium text-gray-800 text-sm sm:text-base">{entry.score}</td>
                        <td className="px-2 sm:px-4 py-3 text-center">
                          <span className={`font-bold px-1 sm:px-2 py-1 rounded text-xs sm:text-sm ${
                            entry.grade === 'A' ? 'bg-green-100 text-green-800' :
                            entry.grade === 'B' ? 'bg-green-50 text-green-700' :
                            entry.grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                            entry.grade === 'D' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {entry.grade}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-2 sm:px-4 py-3 text-right text-gray-600 text-sm">
                          {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-white">
                No scores available yet. Be the first to set a score!
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Leaderboard