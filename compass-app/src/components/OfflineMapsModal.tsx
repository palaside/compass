import React, { useState } from 'react';
import {
  X,
  Download,
  Check,
  Trash2,
  HardDrive,
  Map,
  Layers,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { OfflineMapPackage } from '../types';
import { DEFAULT_OFFLINE_MAP_PACKAGES } from '../utils/geo';
import { playTacticalClick, playWaypointMarkedChime } from '../utils/audio';

interface OfflineMapsModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
}

export function OfflineMapsModal({
  isOpen,
  onClose,
  soundEnabled,
}: OfflineMapsModalProps) {
  const [packages, setPackages] = useState<OfflineMapPackage[]>(() => {
    const saved = localStorage.getItem('offroad_offline_packs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return DEFAULT_OFFLINE_MAP_PACKAGES;
  });

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  if (!isOpen) return null;

  // Calculate total cached size
  const totalCachedMB = packages
    .filter((p) => p.isDownloaded)
    .reduce((sum, p) => sum + p.sizeMB, 0);

  const handleDownload = (id: string) => {
    playTacticalClick(soundEnabled);
    setDownloadingId(id);
    setDownloadProgress(10);

    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setDownloadingId(null);
          playWaypointMarkedChime(soundEnabled);

          const updated = packages.map((p) =>
            p.id === id
              ? { ...p, isDownloaded: true, downloadedAt: Date.now() }
              : p
          );
          setPackages(updated);
          localStorage.setItem('offroad_offline_packs', JSON.stringify(updated));
          return 0;
        }
        return prev + 20;
      });
    }, 300);
  };

  const handleDelete = (id: string) => {
    playTacticalClick(soundEnabled);
    const updated = packages.map((p) =>
      p.id === id ? { ...p, isDownloaded: false, downloadedAt: undefined } : p
    );
    setPackages(updated);
    localStorage.setItem('offroad_offline_packs', JSON.stringify(updated));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono select-none">
      <div className="bg-[#08120b] border border-[#1b2f21] rounded-2xl w-full max-w-xl text-[#10b981] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1b2f21] bg-[#050d07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0e1d13] border border-[#10b981] flex items-center justify-center text-[#CEDE62]">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100">
                OFFLINE MAP PACKAGES (แผนที่ออฟไลน์)
              </h2>
              <p className="text-[11px] text-[#3be099]">
                ดาวน์โหลดข้อมูลแผนที่เส้นชั้นความสูงและภูมิประเทศล่วงหน้าสำหรับพื้นที่ไร้สัญญาณ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage Bar Overview */}
        <div className="p-4 bg-[#0a160e] border-b border-[#182a1c] flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-300 font-bold block">
              พื้นที่จัดเก็บแผนที่ออฟไลน์ในเครื่อง (Cache Storage)
            </span>
            <span className="text-[11px] text-gray-400">
              บันทึกแล้ว {packages.filter((p) => p.isDownloaded).length} พื้นที่ ({totalCachedMB} MB)
            </span>
          </div>
          <div className="px-3 py-1 bg-[#122416] border border-[#10b981]/50 rounded-lg text-xs font-bold text-[#CEDE62]">
            ออฟไลน์พร้อมใช้งาน 100%
          </div>
        </div>

        {/* Regional Packages List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {packages.map((pack) => {
            const isThisDownloading = downloadingId === pack.id;

            return (
              <div
                key={pack.id}
                className="bg-[#050e07] border border-[#16291a] rounded-xl p-3.5 flex flex-col gap-2 hover:border-[#10b981]/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-gray-100 flex items-center gap-2">
                      {pack.name}
                    </h3>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                      {pack.province} • {pack.region}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-[#CEDE62] block">
                      {pack.sizeMB} MB
                    </span>
                    <span className="text-[10px] text-gray-500">
                      ~{pack.tileCount.toLocaleString()} tiles
                    </span>
                  </div>
                </div>

                {/* Progress Bar if downloading */}
                {isThisDownloading && (
                  <div className="w-full bg-[#0d1f11] rounded-full h-2 overflow-hidden border border-[#10b981]/40 mt-1">
                    <div
                      className="bg-[#CEDE62] h-full transition-all duration-200"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-800 text-xs">
                  <div className="text-[10px] text-gray-400">
                    {pack.isDownloaded ? (
                      <span className="text-[#3be099] flex items-center gap-1 font-bold">
                        <Check className="w-3.5 h-3.5" /> บันทึกลงเครื่องแล้ว
                      </span>
                    ) : (
                      <span>ยังไม่ได้ดาวน์โหลด</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {pack.isDownloaded ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(pack.id)}
                        className="px-2.5 py-1 text-[11px] rounded bg-red-950/40 border border-red-800 text-red-400 hover:bg-red-900/60 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> ลบข้อมูล
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isThisDownloading}
                        onClick={() => handleDownload(pack.id)}
                        className="px-3 py-1 text-[11px] rounded bg-[#10b981] hover:bg-[#059669] text-black font-bold flex items-center gap-1 disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {isThisDownloading ? `กำลังโหลด ${downloadProgress}%` : 'ดาวน์โหลดออฟไลน์'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#050d07] border-t border-[#1b2f21] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1b2f21] hover:bg-[#25422e] text-[#CEDE62] rounded-lg text-xs font-bold border border-[#10b981]/50"
          >
            ปิดหน้าต่าง (Done)
          </button>
        </div>

      </div>
    </div>
  );
}
