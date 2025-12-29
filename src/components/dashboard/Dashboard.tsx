'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface DashboardProps {
  profile: any;
  onSignOut: () => void;
}

export function Dashboard({ profile, onSignOut }: DashboardProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!supabase) return;
    
    try {
      const [projectsRes, employeesRes] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('employees').select('*').order('name'),
      ]);

      setProjects(projectsRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !newProjectName.trim()) return;

    try {
      const { error } = await supabase.from('projects').insert({
        organisation_id: profile.organisation_id,
        name: newProjectName.trim(),
      });

      if (error) throw error;

      setNewProjectName('');
      setShowNewProject(false);
      loadData();
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Fatigue Management</h1>
            <p className="text-sm text-gray-500">{profile?.organisations?.name || 'My Organisation'}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{profile?.email}</span>
            <button 
              onClick={onSignOut}
              className="bg-gray-200 px-4 py-2 rounded text-sm hover:bg-gray-300"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4">
        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-500">Projects</p>
            <p className="text-2xl font-semibold">{projects.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-500">Employees</p>
            <p className="text-2xl font-semibold">{employees.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-500">Status</p>
            <p className="text-2xl font-semibold text-green-600">Active</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <button
            onClick={() => setShowNewProject(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
          >
            + New Project
          </button>
        </div>

        {/* New Project Form */}
        {showNewProject && (
          <div className="mb-6 bg-white p-4 rounded-lg shadow">
            <form onSubmit={createProject} className="flex gap-4">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowNewProject(false)}
                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Projects Grid */}
        <h2 className="text-lg font-semibold mb-4">Projects</h2>
        {projects.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow text-center">
            <p className="text-gray-500 mb-4">No projects yet</p>
            <button
              onClick={() => setShowNewProject(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
              >
                <h3 className="font-semibold text-lg mb-2">{project.name}</h3>
                <p className="text-sm text-gray-500">{project.location || 'No location'}</p>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    Created: {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Employees Section */}
        <h2 className="text-lg font-semibold mb-4 mt-8">Employees</h2>
        {employees.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-500">No employees added yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{emp.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{emp.role || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{emp.email || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
