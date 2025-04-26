import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function Leaderboard() {
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
        throw error
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
    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Furnace Commander Leaderboard</h2>
        <select
          className="px-3 py-1 border border-gray-300 rounded"
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
          <table className="w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th 
                  className="px-4 py-3 text-left cursor-pointer hover:bg-gray-200"
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
                  className="px-4 py-3 text-right cursor-pointer hover:bg-gray-200"
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
                  className="px-4 py-3 text-center cursor-pointer hover:bg-gray-200"
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
                  className="px-4 py-3 text-right cursor-pointer hover:bg-gray-200"
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
                  <td className="px-4 py-3 text-gray-800">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{entry.player_name}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{entry.score}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold px-2 py-1 rounded ${
                      entry.grade === 'A' ? 'bg-green-100 text-green-800' :
                      entry.grade === 'B' ? 'bg-green-50 text-green-700' :
                      entry.grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                      entry.grade === 'D' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {entry.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 text-sm">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No scores available yet. Be the first to set a score!
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <button 
          className="px-4 py-2 bg-blue-600 text-gray-700 rounded hover:bg-blue-700"
          onClick={() => window.history.back()}
        >
          Back to Game
        </button>
      </div>
    </div>
  )
}

export default Leaderboard