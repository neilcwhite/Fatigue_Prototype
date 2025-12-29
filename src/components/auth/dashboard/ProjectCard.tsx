'use client';

import React from 'react';
import { Project, ProjectStats } from '@/lib/types';

interface ProjectCardProps {
  project: Project;
  stats?: ProjectStats;
  onClick: () => void;
}

export function ProjectCard({ project, stats, onClick }: ProjectCardProps) {
  const getStatusColor = () => {
    if (!stats) return 'bg-gray-400';
    if (stats.violationCount > 0) return 'bg-red-500';
    if (stats.warningCount > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div
      onClick={onClick}
      className="card cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="card-body">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">{project.name}</h3>
            {project.location && (
              <p className="text-sm text-gray-500">{project.location}</p>
            )}
          </div>
          <span className={`status-dot ${getStatusColor()}`} />
        </div>

        {stats ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold">{stats.employeeCount}</p>
              <p className="text-xs text-gray-500">Staff</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{stats.totalHours}</p>
              <p className="text-xs text-gray-500">Hours</p>
            </div>
            <div>
              <p className={`text-lg font-semibold ${stats.violationCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.violationCount}
              </p>
              <p className="text-xs text-gray-500">Violations</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <div className="spinner mx-auto" />
          </div>
        )}

        {project.start_date && project.end_date && (
          <p className="mt-3 text-xs text-gray-400">
            {new Date(project.start_date).toLocaleDateString()} - {new Date(project.end_date).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
