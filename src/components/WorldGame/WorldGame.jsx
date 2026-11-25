import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { MAP_W, MAP_H, getWorldRasterData } from "../../world/worldRasterizer";
import {
  WorldSimulationEngine,
  UPGRADE_DEFINITIONS,
  DOCTRINE_DEFINITIONS,
  POP_SUPPORT_TIERS,
  getPopSupportCost,
} from "../../world/worldEngine";
import { WorldMapRenderer } from "../../world/worldRenderer";
import { checkNetworkAndSecurity } from "../../world/networkSecurity";
import {
  LogoSwords,
  LogoGold,
  LogoPopulation,
  LogoTerritory,
  LogoNavy,
  LogoPan,
  LogoPalette,
  LogoCitadel,
  LogoNuclear,
  UpgradeLogo,
} from "./GameLogos";
import { soundManager } from "../../utils/audio";
import confetti from "canvas-confetti";
import {
  ArrowLeft,
  Upload,
  Globe,
  ZoomIn,
  ZoomOut,
  Compass,
  Volume2,
  VolumeX,
  HelpCircle,
  X,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  WifiOff,
  CloudOff,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Crown,
  Trash2,
  Zap,
  Download,
  RefreshCw,
  Handshake,
  Coins,
  Shield,
  Check,
  FileText,
  XCircle,
  ShoppingBag,
  Package,
  BarChart2,
  Award,
  Flame,
  Star,
} from "lucide-react";
import { checkAppVersion } from "../../utils/versionCheck";

export default function WorldGame({ onReturnToModeSelect }) {
  // Raster grey world data (1000x500)
  const worldData = useMemo(() => getWorldRasterData(), []);

  // Synchronized Engine & Renderer Refs
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const rendererRef = useRef(null);
  const fileInputRef = useRef(null);
  const updateFlagInputRef = useRef(null);

  // Camera Ref: panX, panY, zoom
  const cameraRef = useRef({ zoom: 1.0, panX: 0, panY: 0 });

  // Security & IP State
  const [networkInfo, setNetworkInfo] = useState({
    clientIp: "",
    isVpnOrProxy: false,
    isAdmin: false,
    hasExistingCountry: false,
    checked: false,
  });

  // Founding Modal State (when player clicks an unclaimed pixel)
  const [foundingModal, setFoundingModal] = useState(null); // { x, y }
  const [foundName, setFoundName] = useState("");
  const [foundColor, setFoundColor] = useState(() => {
    const palette = [
      "#E11D48", "#2563EB", "#10B981", "#F59E0B", "#8B5CF6",
      "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#14B8A6",
    ];
    return palette[Math.floor(Math.random() * palette.length)];
  });
  const [foundFlagDataUrl, setFoundFlagDataUrl] = useState(null);

  // VPN Block Modal & Mandatory Version Update & Server Maintenance/Connection Block
  const [vpnBlocked, setVpnBlocked] = useState(false);
  const [serverBlocked, setServerBlocked] = useState(false);
  const [mandatoryUpdate, setMandatoryUpdate] = useState(null);
  const [optionalAppUpdate, setOptionalAppUpdate] = useState(null);
  const [webUpdateAvailable, setWebUpdateAvailable] = useState(false);

  // Modes & UI
  const [toolMode, setToolMode] = useState("CONQUER"); // 'CONQUER' | 'PAN'
  const toolModeRef = useRef("CONQUER");
  useEffect(() => {
    toolModeRef.current = toolMode;
  }, [toolMode]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showCountriesList, setShowCountriesList] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [photoPreviewModal, setPhotoPreviewModal] = useState(null); // { url, name }
  const [offlinePackageModal, setOfflinePackageModal] = useState(null); // { troops, gold, popGrown, timeStr }
  const [showQuestsModal, setShowQuestsModal] = useState(false);
  const [dailyStreakModal, setDailyStreakModal] = useState(null); // streak info
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const hasCenteredOnMyCountryRef = useRef(false);

  // Diplomacy & Treaties State (İttifak & Haraç)
  const [showDiplomacyModal, setShowDiplomacyModal] = useState(false);
  const [diplomacyTab, setDiplomacyTab] = useState("ACTIVE"); // 'ACTIVE' | 'INCOMING' | 'NEW'
  const [treatiesList, setTreatiesList] = useState([]);
  const [treatyWarningModal, setTreatyWarningModal] = useState(null); // { x, y, treaty, targetCountry }

  // New Treaty Form State
  const [targetCountryId, setTargetCountryId] = useState("");
  const [treatyType, setTreatyType] = useState("ALLIANCE"); // 'ALLIANCE' | 'TRIBUTE' | 'LAND_PURCHASE'
  const [penaltyAmount, setPenaltyAmount] = useState(2500);
  const [tributeAmount, setTributeAmount] = useState(150);
  const [tributeRole, setTributeRole] = useState("RECEIVER"); // 'RECEIVER' | 'PAYER'
  const [landPixelCount, setLandPixelCount] = useState(25);
  const [landPricePerPixel, setLandPricePerPixel] = useState(50);

  // Market & Inventory State (Paralı Asker & Nükleer Silah)
  const [showMarket, setShowMarket] = useState(false);
  const [marketTab, setMarketTab] = useState("STORE"); // 'STORE' | 'OWNED'

  // Auto Conquer State (Yukarıdaki Oto Fethet)
  const [autoConquer, setAutoConquer] = useState(false);
  const autoConquerRef = useRef(false);

  useEffect(() => {
    autoConquerRef.current = autoConquer;
  }, [autoConquer]);

  useEffect(() => {
    if (!autoConquer) return;
    const timer = setInterval(() => {
      const eng = engineRef.current;
      const myC = eng?.getMyCountry();
      if (!myC || !autoConquerRef.current) return;
      if (myC.troops >= 0.8) {
        eng.conquerNextBorderPixel(myC.id, true);
      }
    }, 320);

    return () => clearInterval(timer);
  }, [autoConquer]);

  // Nuclear Strike Weapon State
  const [isTargetingNuke, setIsTargetingNuke] = useState(false);
  const isTargetingNukeRef = useRef(false);
  useEffect(() => {
    isTargetingNukeRef.current = isTargetingNuke;
  }, [isTargetingNuke]);
  const [nukeConfirmModal, setNukeConfirmModal] = useState(null); // { x, y }

  // Under Attack Alarm State (Red Flash Screen + Audio Siren + Action Banner)
  const [underAttackAlert, setUnderAttackAlert] = useState(null); // { attackerName, x, y, isNuke, time }
  const attackAlertTimerRef = useRef(null);

  // Admin Custom Value State
  const [adminCustomTroops, setAdminCustomTroops] = useState(100);
  const [adminCustomGold, setAdminCustomGold] = useState(5000);
  const [adminCustomNukes, setAdminCustomNukes] = useState(1);
  const [adminCustomLand, setAdminCustomLand] = useState(25);
  const [adminGlobalGold, setAdminGlobalGold] = useState(10000);
  const [adminGlobalTroops, setAdminGlobalTroops] = useState(100);
  const [adminGlobalNukes, setAdminGlobalNukes] = useState(1);
  const [adminTargetCountryId, setAdminTargetCountryId] = useState("");
  const [adminTargetTroops, setAdminTargetTroops] = useState(100);
  const [adminTargetGold, setAdminTargetGold] = useState(5000);
  const [adminTargetNukes, setAdminTargetNukes] = useState(1);
  const [adminTargetLand, setAdminTargetLand] = useState(20);

  // Real-time HUD state
  const [hud, setHud] = useState({
    myCountry: null,
    totalCountriesCount: 0,
    allCountries: [],
    connectedPeers: 0,
    isCloudConnected: false,
    hasInitialSyncLoaded: false,
    isSyncError: false,
    lastWriteError: false,
    time: 0,
  });

  // Global Chat State (minimized by default on mobile phones so it doesn't cover the map)
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMinimized, setChatMinimized] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );
  const chatBottomRef = useRef(null);

  // Mouse & Touch interaction tracking
  const hoveredPosRef = useRef(null);
  const isMouseDownRef = useRef(false);
  const isPaintingRef = useRef(false);
  const conqueredOnDownRef = useRef(false);
  const lastCellRef = useRef(null);
  const lastConquerTimeRef = useRef(0);
  const tapOriginRef = useRef({ x: 0, y: 0, moved: false, pointerCount: 0 });
  const pointersRef = useRef(new Map());
  const lastPinchDistRef = useRef(0);
  const lastPinchEndTimeRef = useRef(0);
  const lastTickTimeRef = useRef(performance.now());
  const soundEnabledRef = useRef(soundEnabled);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const showToast = useCallback((msg) => {
    if (!msg) return;
    if (typeof msg === "object") {
      if (msg.type === "NUCLEAR_STRIKE") {
        setToastMessage(
          msg.isLocal
            ? "Nükleer başlık patladı! Bölge nükleer çorak araziye dönüştü!"
            : "DİKKAT: Dünyada taktik bir nükleer saldırı gerçekleşti!",
        );
      } else {
        setToastMessage(msg.message || JSON.stringify(msg));
      }
    } else {
      setToastMessage(String(msg));
    }
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setToastMessage(null);
    }, 3400);
  }, []);

  // Initialize Engine & Renderer singleton
  if (!rendererRef.current) {
    rendererRef.current = new WorldMapRenderer(worldData);
  }
  if (!engineRef.current) {
    engineRef.current = new WorldSimulationEngine(worldData, {
      onEvent: (msg) => showToast(msg),
      onChat: (msgs) => setChatMessages([...msgs]),
      onSound: (sound) => {
        if (!soundEnabledRef.current) return;
        if (sound === "pencil") soundManager.playPencil();
        else if (sound === "celebration") {
          soundManager.playCelebration();
          try {
            confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
          } catch {}
        } else if (sound === "siren") {
          soundManager.playSiren();
        }
      },
      onUnderAttack: (alertData) => {
        setUnderAttackAlert(alertData);
        if (soundEnabledRef.current) {
          soundManager.playSiren();
        }
        if (attackAlertTimerRef.current) clearTimeout(attackAlertTimerRef.current);
        attackAlertTimerRef.current = setTimeout(() => {
          setUnderAttackAlert(null);
        }, 5500);
      },
    });
  }

  // Start cloud sync after mount, not in the render-time engine constructor.
  // This keeps React StrictMode's development mount/cleanup/remount cycle safe.
  useEffect(() => {
    const sync = engineRef.current?.ensureSync?.();
    
    // Check initial connection after a short grace period (5.5 seconds)
    // If not connected to server after grace period, or if initial sync failed, block gameplay
    const connTimer = setTimeout(() => {
      const isConnected = Boolean(engineRef.current?.sync?.isCloudConnected);
      const isLoaded = Boolean(engineRef.current?.sync?.hasInitialSyncLoaded);
      if (!isConnected || !isLoaded) {
        setServerBlocked(true);
      }
    }, 5500);

    return () => {
      clearTimeout(connTimer);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      engineRef.current?.sync?.destroy?.();
    };
  }, []);

  // Continuous monitoring: If sync errors out or a cloud write fails, immediately show server maintenance block modal
  useEffect(() => {
    if (hud.isSyncError || hud.lastWriteError) {
      setServerBlocked(true);
    } else if (hud.isCloudConnected && hud.hasInitialSyncLoaded && !hud.lastWriteError) {
      setServerBlocked(false);
    }
  }, [hud.isSyncError, hud.lastWriteError, hud.isCloudConnected, hud.hasInitialSyncLoaded]);

  // Load initial chat messages on mount
  useEffect(() => {
    if (engineRef.current?.chatMessages) {
      setChatMessages([...engineRef.current.chatMessages]);
    }
  }, []);

  useEffect(() => {
    if (!chatMinimized && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatMinimized]);

  const handleSendChatMessage = useCallback(
    (e) => {
      e?.preventDefault();
      if (!chatInput.trim()) return;
      const eng = engineRef.current;
      if (!eng || !eng.sync) return;
      eng.sync.sendChatMessage(chatInput.trim(), networkInfo.isAdmin);
      setChatInput("");
    },
    [chatInput, networkInfo.isAdmin],
  );

  // Network & Security Check on Mount + Auto-Reconnect to country via IP + App Version Checker
  useEffect(() => {
    checkNetworkAndSecurity().then((info) => {
      setNetworkInfo({ ...info, checked: true });
      if (info.isVpnOrProxy) {
        setVpnBlocked(true);
      }
      if (engineRef.current && info.clientIp) {
        engineRef.current.restoreMyCountryFromServer(info.clientIp);
      }
    });

    // Check version: if outdated on Android app, enforce mandatory update modal!
    // On web, if an update is available, alert and automatically reload so all players get the latest version immediately!
    const runVersionCheck = () => {
      checkAppVersion().then((ver) => {
        if (ver.isMandatory) {
          setMandatoryUpdate(ver);
        } else if (ver.isNative && ver.isOptionalUpdate) {
          setOptionalAppUpdate(ver);
        } else if (ver.needsUpdate && !ver.isNative) {
          setWebUpdateAvailable(true);
          // Show non-intrusive alert then reload after 2.5s if user hasn't clicked
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      });
    };

    runVersionCheck();
    // Periodically re-check version every 60 seconds so active players auto-update
    const versionInterval = setInterval(runVersionCheck, 60000);

    return () => {
      clearInterval(versionInterval);
    };
  }, []);

  const getBaseScale = useCallback((viewW, viewH) => {
    return Math.max(viewW / MAP_W, (viewH * 0.68) / MAP_H);
  }, []);

  // Center camera on coordinates without drift (robust against undefined/NaN values)
  const centerOnCoords = useCallback(
    (cx, cy, targetZoom = 14.0) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const viewW = canvas.clientWidth || window.innerWidth || 800;
      const viewH = canvas.clientHeight || window.innerHeight || 600;
      const baseScale = getBaseScale(viewW, viewH) || 1.0;
      const safeZoom =
        Number.isFinite(targetZoom) && targetZoom > 0 ? targetZoom : 14.0;
      const safeX = Number.isFinite(cx) ? cx : MAP_W / 2;
      const safeY = Number.isFinite(cy) ? cy : MAP_H / 2;
      const scale = baseScale * safeZoom;

      cameraRef.current = {
        zoom: safeZoom,
        panX: (MAP_W / 2 - safeX) * scale,
        panY: (MAP_H / 2 - safeY) * scale,
      };
    },
    [getBaseScale],
  );

  // Zoom relative to viewport center without drift (up to 85x so individual pixels are large on mobile!)
  const handleZoom = useCallback((factor) => {
    const oldZoom =
      Number.isFinite(cameraRef.current.zoom) && cameraRef.current.zoom > 0
        ? cameraRef.current.zoom
        : 1.0;
    const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1.0;
    const newZoom = Math.max(0.8, Math.min(85.0, oldZoom * safeFactor));
    const ratio = newZoom / oldZoom;
    cameraRef.current.zoom = newZoom;
    cameraRef.current.panX = Number.isFinite(cameraRef.current.panX)
      ? cameraRef.current.panX * ratio
      : 0;
    cameraRef.current.panY = Number.isFinite(cameraRef.current.panY)
      ? cameraRef.current.panY * ratio
      : 0;
  }, []);

  // Initial center on Europe/Mediterranean; auto-focus on player's country as soon as server loads it
  useEffect(() => {
    centerOnCoords(550, 175, 2.8);
  }, [centerOnCoords]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !hud.myCountry || hasCenteredOnMyCountryRef.current) return;
    hasCenteredOnMyCountryRef.current = true;
    const center = eng.getCountryCenter(hud.myCountry.id);
    centerOnCoords(center.x, center.y, 16.0);

    // Check collectible offline package
    const offlinePkg = eng.getPendingOfflinePackage();
    if (offlinePkg) {
      setOfflinePackageModal(offlinePkg);
    }

    // Check daily streak
    const streakInfo = eng.getDailyStreakInfo();
    if (!streakInfo.isClaimedToday && !offlinePkg) {
      setDailyStreakModal(streakInfo);
    }
  }, [hud.myCountry, centerOnCoords]);

  // Handle Custom Flag Upload
  const handleFileUpload = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        setFoundFlagDataUrl(ev.target.result);
        showToast("Resim seçildi!");
      };
      reader.readAsDataURL(file);
    },
    [showToast],
  );

  // Handle Dynamic Custom Flag/Image Update for Existing Country
  const handleUpdateFlagFile = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const rawDataUrl = ev.target?.result;
        if (!rawDataUrl) return;
        const myC = engineRef.current?.getMyCountry();
        if (!myC) {
          showToast("Önce bir devletin olmalı!");
          return;
        }
        const ok = await engineRef.current?.updateCountryFlag(myC.id, rawDataUrl);
        if (ok) {
          showToast("Devlet resmi / bayrağı başarıyla güncellendi!");
        } else {
          showToast("Resim güncellenirken bir hata oluştu.");
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [showToast],
  );

  // Found Country Confirmation
  const handleConfirmFoundCountry = useCallback(async () => {
    if (!foundingModal) return;
    if (serverBlocked || !engineRef.current?.sync?.isCloudConnected) {
      setServerBlocked(true);
      showToast("Sunucuya bağlanılamadığı için ülke kurulamaz!");
      return;
    }
    if (networkInfo.isVpnOrProxy) {
      setVpnBlocked(true);
      return;
    }
    if (!foundName.trim()) {
      showToast("Lütfen bir ülke adı yazın!");
      return;
    }

    let flagUrl = foundFlagDataUrl;
    if (!flagUrl) {
      const cv = document.createElement("canvas");
      cv.width = 128;
      cv.height = 80;
      const cctx = cv.getContext("2d");
      cctx.fillStyle = foundColor || "#E11D48";
      cctx.fillRect(0, 0, 128, 80);
      cctx.fillStyle = "#FFFFFF";
      cctx.font = "900 36px Inter, sans-serif";
      cctx.textAlign = "center";
      cctx.textBaseline = "middle";
      const initial = (foundName || "D").trim().charAt(0).toUpperCase();
      cctx.fillText(initial, 64, 40);
      flagUrl = cv.toDataURL("image/png");
    }

    const eng = engineRef.current;
    if (!eng) return;

    const res = await eng.foundCountry({
      name: foundName,
      color: foundColor,
      flagDataUrl: flagUrl,
      capitalX: foundingModal.x,
      capitalY: foundingModal.y,
      creatorIp: networkInfo.clientIp,
    });

    if (res.ok) {
      setFoundingModal(null);
      centerOnCoords(res.country.capitalX, res.country.capitalY, 18.0);
    } else {
      showToast(res.reason || "Devlet kurulamadı.");
    }
  }, [
    foundingModal,
    networkInfo,
    foundName,
    foundColor,
    foundFlagDataUrl,
    centerOnCoords,
    showToast,
  ]);

  // Coordinate mapper from viewport to map coordinates
  const getMapCoords = useCallback(
    (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const vx = clientX - rect.left;
      const vy = clientY - rect.top;

      const viewW = canvas.clientWidth || rect.width;
      const viewH = canvas.clientHeight || rect.height;
      const baseScale = getBaseScale(viewW, viewH);
      const scale = baseScale * cameraRef.current.zoom;
      const mapScreenW = MAP_W * scale;
      const mapScreenH = MAP_H * scale;
      const originX = (viewW - mapScreenW) / 2 + cameraRef.current.panX;
      const originY = (viewH - mapScreenH) / 2 + cameraRef.current.panY;

      const mapX = (vx - originX) / scale;
      const mapY = (vy - originY) / scale;

      return {
        x: Math.floor(mapX),
        y: Math.floor(mapY),
      };
    },
    [getBaseScale],
  );

  // Pointer interactions (Zero-teleport per-pointer tracking, smooth pan, incremental pinch zoom & tap-to-found)
  const handlePointerDown = useCallback(
    (e) => {
      // Record real physical user interaction for Active/Away status tracking
      if (engineRef.current) {
        engineRef.current.lastInputTime = Date.now();
        const myC = engineRef.current.getMyCountry();
        if (myC) myC.lastInputTime = Date.now();
      }

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      isMouseDownRef.current = true;

      if (pointersRef.current.size === 1) {
        tapOriginRef.current = {
          x: e.clientX,
          y: e.clientY,
          moved: false,
          pointerCount: 1,
        };
      } else if (pointersRef.current.size >= 2) {
        tapOriginRef.current.pointerCount = pointersRef.current.size;
        tapOriginRef.current.moved = true;
        isPaintingRef.current = false;
        const pts = Array.from(pointersRef.current.values());
        lastPinchDistRef.current = Math.hypot(
          pts[0].x - pts[1].x,
          pts[0].y - pts[1].y,
        );
        return;
      }

      if (isTargetingNuke) {
        const pos = getMapCoords(e.clientX, e.clientY);
        if (pos && pos.x >= 0 && pos.x < MAP_W && pos.y >= 0 && pos.y < MAP_H) {
          setNukeConfirmModal({ x: pos.x, y: pos.y });
          setIsTargetingNuke(false);
        }
        return;
      }

      if (serverBlocked || !engineRef.current?.sync?.isCloudConnected) {
        showToast("Sunucu bağlantısı yok! Oyun güncelleniyor veya bakım modunda.");
        setServerBlocked(true);
        isPaintingRef.current = false;
        return;
      }

      if (e.button === 2 || e.button === 1 || toolMode === "PAN") {
        isPaintingRef.current = false;
        return;
      }

      const pos = getMapCoords(e.clientX, e.clientY);
      if (pos && pos.x >= 0 && pos.x < MAP_W && pos.y >= 0 && pos.y < MAP_H) {
        lastCellRef.current = { x: pos.x, y: pos.y };

        const eng = engineRef.current;
        const myCountry = eng?.getMyCountry();

        if (!myCountry) {
          isPaintingRef.current = false;
          return;
        }

        // 6px touch-snap radius so mobile thumb taps easily hit adjacent border cells
        const smartTarget = eng.findSmartExpandTarget(
          myCountry.id,
          pos.x,
          pos.y,
          6,
        );
        if (smartTarget && smartTarget.check.isTreatyViolation) {
          isPaintingRef.current = false;
          conqueredOnDownRef.current = false;
          setTreatyWarningModal({
            x: smartTarget.x,
            y: smartTarget.y,
            treaty: smartTarget.check.treaty,
            targetCountry: eng.countryMap.get(smartTarget.check.targetOwner),
          });
          return;
        }
        if (
          smartTarget &&
          !smartTarget.check.isNaval &&
          myCountry.troops >= smartTarget.check.cost
        ) {
          // Strictly conquer 1 single pixel on initial tap, and start paced drag
          isPaintingRef.current = true;
          conqueredOnDownRef.current = true;
          lastCellRef.current = { x: smartTarget.x, y: smartTarget.y };
          lastConquerTimeRef.current = performance.now();
          eng.conquerPixel(myCountry.id, smartTarget.x, smartTarget.y);
        } else {
          isPaintingRef.current = false;
          conqueredOnDownRef.current = false;
          if (smartTarget && myCountry.troops < smartTarget.check.cost) {
            showToast(`Yetersiz Asker! (Gereken: ${smartTarget.check.cost.toFixed(1)} Asker)`);
          } else {
            const check = eng.canExpandToPixel(myCountry.id, pos.x, pos.y);
            if (!check.valid && check.reason) {
              showToast(check.reason);
            }
          }
        }
      }
    },
    [getMapCoords, toolMode, isTargetingNuke, showToast],
  );

  const handlePointerMove = useCallback(
    (e) => {
      const pos = getMapCoords(e.clientX, e.clientY);
      if (pos) {
        hoveredPosRef.current = pos;
      }

      const prevPt = pointersRef.current.get(e.pointerId);
      if (!prevPt) return;

      const dx = e.clientX - prevPt.x;
      const dy = e.clientY - prevPt.y;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const distFromTap = Math.hypot(
        e.clientX - tapOriginRef.current.x,
        e.clientY - tapOriginRef.current.y,
      );
      if (distFromTap > 10) {
        tapOriginRef.current.moved = true;
      }

      if (pointersRef.current.size === 2) {
        // Incremental 2-finger pinch zoom (never jumps or teleports!)
        const pts = Array.from(pointersRef.current.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (lastPinchDistRef.current > 12 && dist > 12) {
          const stepFactor = dist / lastPinchDistRef.current;
          if (stepFactor > 0.75 && stepFactor < 1.35) {
            handleZoom(stepFactor);
          }
        }
        lastPinchDistRef.current = dist;
        lastPinchEndTimeRef.current = performance.now();
        return;
      }

      if (pointersRef.current.size === 1) {
        // Ignore single-finger pan for 140ms right after lifting a 2nd pinch finger to prevent any jump
        if (performance.now() - lastPinchEndTimeRef.current < 140) {
          return;
        }

        // IN PAN MODE: Smooth 1:1 camera drag panning
        // IN CONQUER MODE: Allows smooth controlled drag-to-conquer (1 pixel per 80ms max, 1 tap never multi-conquers)
        if (toolMode === "PAN" && isMouseDownRef.current) {
          if (Math.abs(dx) < 120 && Math.abs(dy) < 120) {
            cameraRef.current.panX += dx;
            cameraRef.current.panY += dy;
          }
        } else if (toolMode === "CONQUER" && isPaintingRef.current && isMouseDownRef.current) {
          const now = performance.now();
          if (now - lastConquerTimeRef.current >= 80) {
            if (
              pos &&
              lastCellRef.current &&
              (pos.x !== lastCellRef.current.x || pos.y !== lastCellRef.current.y)
            ) {
              const eng = engineRef.current;
              const myCountry = eng?.getMyCountry();
              if (myCountry) {
                const smartTarget = eng.findSmartExpandTarget(
                  myCountry.id,
                  pos.x,
                  pos.y,
                  3,
                );
                if (
                  smartTarget &&
                  !smartTarget.check.isNaval &&
                  !smartTarget.check.isTreatyViolation &&
                  myCountry.troops >= smartTarget.check.cost
                ) {
                  const res = eng.conquerPixel(
                    myCountry.id,
                    smartTarget.x,
                    smartTarget.y,
                  );
                  if (res.ok) {
                    lastCellRef.current = { x: smartTarget.x, y: smartTarget.y };
                    lastConquerTimeRef.current = now;
                  }
                }
              }
            }
          }
        }
      }
    },
    [getMapCoords, handleZoom, toolMode],
  );

  const handlePointerUp = useCallback(
    (e) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}

      const wasCleanSingleTap =
        !tapOriginRef.current.moved &&
        tapOriginRef.current.pointerCount === 1 &&
        e.button !== 2 &&
        e.button !== 1 &&
        toolMode !== "PAN";

      const hadMultiplePointers = pointersRef.current.size >= 2;
      pointersRef.current.delete(e.pointerId);

      if (hadMultiplePointers) {
        lastPinchDistRef.current = 0;
        lastPinchEndTimeRef.current = performance.now();
      }

      const alreadyConqueredOnDown = conqueredOnDownRef.current;

      if (pointersRef.current.size === 0) {
        isMouseDownRef.current = false;
        isPaintingRef.current = false;
        conqueredOnDownRef.current = false;
        lastCellRef.current = null;
      }

      if (wasCleanSingleTap) {
        // First check if user tapped on a country's emblem/flag on the map to zoom in & view image
        if (rendererRef.current && canvasRef.current) {
          const hitCrest = rendererRef.current.getHitCrest(e.clientX, e.clientY, canvasRef.current);
          if (hitCrest && hitCrest.flagDataUrl) {
            setPhotoPreviewModal({
              url: hitCrest.flagDataUrl,
              name: hitCrest.countryName || "Devlet Resmi",
              color: hitCrest.color,
            });
            return;
          }
        }

        if (serverBlocked || !engineRef.current?.sync?.isCloudConnected) {
          setServerBlocked(true);
          return;
        }

        const pos = getMapCoords(e.clientX, e.clientY);
        if (!pos || pos.x < 0 || pos.x >= MAP_W || pos.y < 0 || pos.y >= MAP_H)
          return;

        const eng = engineRef.current;
        if (!eng) return;
        const myCountry = eng.getMyCountry();

        if (!myCountry) {
          const idx = pos.y * MAP_W + pos.x;
          const tappedOwnerId = eng.owners[idx];

          if (tappedOwnerId > 0) {
            const tappedCountry = eng.countryMap.get(tappedOwnerId);
            showToast(
              tappedCountry
                ? `Bu toprak "${tappedCountry.name}" devletine ait! Sahipsiz gri bir piksele dokunarak kendi devletini kurabilirsin.`
                : "Bu piksel zaten başka bir devlete ait!",
            );
            return;
          }

          if (worldData.isLand[idx] && tappedOwnerId === 0) {
            if (networkInfo.isVpnOrProxy) {
              setVpnBlocked(true);
              return;
            }
            const existing = eng.countries.find(
              (c) => c.deviceId === eng.myDeviceId && c.landCount > 0,
            );
            if (existing) {
              showToast(`Bu cihazdan zaten "${existing.name}" kurulmuş!`);
              eng.myCountryId = existing.id;
              const center = eng.getCountryCenter(existing.id);
              centerOnCoords(center.x, center.y, 16.0);
              return;
            }
            setFoundingModal({ x: pos.x, y: pos.y });
          } else {
            showToast(
              "Deniz veya okyanusa ülke kurulamaz! Gri bir kara pikseline dokun.",
            );
          }
        } else if (!alreadyConqueredOnDown) {
          const smartTarget = eng.findSmartExpandTarget(
            myCountry.id,
            pos.x,
            pos.y,
            6,
          );
          if (smartTarget) {
            if (smartTarget.check.isTreatyViolation) {
              setTreatyWarningModal({
                x: smartTarget.x,
                y: smartTarget.y,
                treaty: smartTarget.check.treaty,
                targetCountry: eng.countryMap.get(smartTarget.check.targetOwner),
              });
              return;
            }
            const res = eng.conquerPixel(
              myCountry.id,
              smartTarget.x,
              smartTarget.y,
            );
            if (!res.ok && res.reason) {
              showToast(res.reason);
            }
          } else {
            const check = eng.canExpandToPixel(myCountry.id, pos.x, pos.y);
            if (check.isTreatyViolation) {
              setTreatyWarningModal({
                x: pos.x,
                y: pos.y,
                treaty: check.treaty,
                targetCountry: eng.countryMap.get(check.targetOwner),
              });
              return;
            }
            if (check.valid && check.isNaval) {
              const res = eng.conquerPixel(myCountry.id, pos.x, pos.y);
              if (!res.ok && res.reason) {
                showToast(res.reason);
              }
            }
          }
        }
      }
    },
    [getMapCoords, toolMode, worldData, networkInfo, showToast, centerOnCoords],
  );

  // Non-passive wheel event listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.2 : 0.83;
      handleZoom(factor);
    };

    const preventContext = (e) => e.preventDefault();

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", preventContext);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", preventContext);
    };
  }, [handleZoom]);

  // 60 FPS Real-time Render & Continuous Troop Production Loop
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    let lastHudSync = 0;

    const loop = (now) => {
      const dt = Math.min(0.1, (now - lastTickTimeRef.current) / 1000);
      lastTickTimeRef.current = now;

      // 1. Update continuous real-time troop generation
      if (engineRef.current) {
        engineRef.current.update(dt);
      }

      // 2. Render frame onto viewport (cap DPR on mobile screens for smooth 60 FPS)
      const viewW = canvas.clientWidth || window.innerWidth;
      const viewH = canvas.clientHeight || window.innerHeight;
      const isMobileScreen = viewW < 900 || viewH < 550;
      const dpr = isMobileScreen
        ? Math.min(window.devicePixelRatio || 1, 1.15)
        : Math.min(window.devicePixelRatio || 1, 2);

      const targetW = Math.floor(viewW * dpr);
      const targetH = Math.floor(viewH * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      if (rendererRef.current && engineRef.current) {
        rendererRef.current.renderFrame(
          ctx,
          viewW,
          viewH,
          cameraRef.current,
          engineRef.current,
          {
            hoveredMapPos: hoveredPosRef.current,
            timeSec: now / 1000,
            toolMode: toolModeRef.current,
            isTargetingNuke: isTargetingNukeRef.current,
          },
        );
      }

      ctx.restore();

      // 3. Throttle HUD state update to React (every ~220ms)
      if (now - lastHudSync > 220) {
        lastHudSync = now;
        const eng = engineRef.current;
        if (eng) {
          const myC = eng.getMyCountry();
          const cutoff = Date.now() - 5000;
          const undos = (eng.undoStack || []).filter((u) => u.time >= cutoff);
          const latestUndo = undos.length > 0 ? undos[undos.length - 1] : null;
          const undoSec = latestUndo
            ? Math.max(
                0,
                Math.ceil((5000 - (Date.now() - latestUndo.time)) / 1000),
              )
            : 0;

          const activeCountryIds = new Set();
          const activeList = [];
          for (const c of eng.countries) {
            if (c.landCount > 0) {
              activeCountryIds.add(c.id);
              activeList.push(c);
            }
          }

          setHud({
            myCountry: myC ? { ...myC } : null,
            totalCountriesCount: activeCountryIds.size,
            allCountries: activeList,
            connectedPeers: eng.sync?.getConnectedPeersCount() || 0,
            isCloudConnected: Boolean(eng.sync?.isCloudConnected),
            hasInitialSyncLoaded: Boolean(eng.sync?.hasInitialSyncLoaded),
            isSyncError: Boolean(eng.sync?.isSyncError),
            lastWriteError: Boolean(eng.sync?.lastWriteError),
            canUndo: undos.length > 0,
            undoSeconds: undoSec,
            time: now,
          });
          if (Array.isArray(eng.treaties)) {
            setTreatiesList([...eng.treaties]);
          }
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  const myCountry = hud.myCountry;

  const pendingIncomingCount = useMemo(() => {
    if (!myCountry) return 0;
    const pendingTreaties = treatiesList.filter(
      (t) => t.toId === myCountry.id && t.status === "PENDING",
    ).length;
    const pendingTerminations = treatiesList.filter(
      (t) =>
        t.status === "ACTIVE" &&
        (t.fromId === myCountry.id || t.toId === myCountry.id) &&
        t.terminationRequestedBy &&
        t.terminationRequestedBy !== myCountry.id,
    ).length;
    return pendingTreaties + pendingTerminations;
  }, [treatiesList, myCountry]);

  // Diplomacy Treaty Handlers
  const handleSendTreatyProposal = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || !myCountry) return;
    if (!targetCountryId) {
      showToast("Lütfen bir hedef devlet seçin!");
      return;
    }
    const res = eng.proposeTreaty({
      toCountryId: Number(targetCountryId),
      type: treatyType,
      penalty: Number(penaltyAmount),
      tributeAmount: Number(tributeAmount),
      tributeRole: tributeRole,
      landPixelCount: Number(landPixelCount),
      landPricePerPixel: Number(landPricePerPixel),
    });
    if (res.ok) {
      showToast("Anlaşma teklifi başarıyla gönderildi!");
      setDiplomacyTab("ACTIVE");
    } else {
      showToast(res.reason || "Teklif gönderilemedi.");
    }
  }, [myCountry, targetCountryId, treatyType, penaltyAmount, tributeAmount, tributeRole, landPixelCount, landPricePerPixel, showToast]);

  const handleBuyMercenaries = useCallback((count) => {
    const eng = engineRef.current;
    if (!eng || !myCountry) return;
    const res = eng.buyMercenaries(myCountry.id, count);
    if (res.ok) {
      showToast(`${res.count} Paralı Asker kiralandı! (-${res.cost.toLocaleString()} Altın)`);
    } else {
      showToast(res.reason || "Paralı asker alınamadı.");
    }
  }, [myCountry, showToast]);

  const handleBuyPopulationSupport = useCallback((tierKey) => {
    const eng = engineRef.current;
    if (!eng || !myCountry) return;
    const res = eng.buyPopulationSupport(myCountry.id, tierKey);
    if (res.ok) {
      showToast(`Halka Nüfus Desteği (${res.tier.label}) aktif! Nüfus hızı +%50 arttı. (-${res.cost.toLocaleString()} Altın)`);
    } else {
      showToast(res.reason || "Nüfus desteği satın alınamadı.");
    }
  }, [myCountry, showToast]);

  const handleBuyNuclear = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || !myCountry) return;
    const res = eng.buyNuclear(myCountry.id);
    if (res.ok) {
      showToast(`1 Adet Taktik Nükleer Silah depolandı! (Envanterinde: ${res.nukes} Adet)`);
    } else {
      showToast(res.reason || "Nükleer silah satın alınamadı.");
    }
  }, [myCountry, showToast]);

  const handleConfirmNukeStrike = useCallback(() => {
    if (!nukeConfirmModal) return;
    const eng = engineRef.current;
    if (!eng || !myCountry) return;
    const { x, y } = nukeConfirmModal;
    const res = eng.launchNuclearStrike(myCountry.id, x, y);
    if (res.ok) {
      showToast(
        `TAKTİK NÜKLEER BAŞLIK FIRLATILDI! BÖLGE YOK EDİLDİ! (Kalan Nükleer: ${res.remainingNukes})`,
      );
    } else {
      showToast(res.reason || "Nükleer silah fırlatılamadı.");
    }
    setNukeConfirmModal(null);
  }, [nukeConfirmModal, myCountry, showToast]);

  const handleAcceptTreaty = useCallback((treatyId) => {
    const eng = engineRef.current;
    if (!eng) return;
    const res = eng.acceptTreaty(treatyId);
    if (res.ok) {
      showToast("Anlaşma kabul edildi ve yürürlüğe girdi!");
    } else {
      showToast(res.reason || "Hata oluştu.");
    }
  }, [showToast]);

  const handleRejectTreaty = useCallback((treatyId) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.rejectTreaty(treatyId);
    showToast("Anlaşma teklifi reddedildi.");
  }, [showToast]);

  const handleRequestTreatyTermination = useCallback((treatyId) => {
    const eng = engineRef.current;
    if (!eng || !myCountry) return;
    const res = eng.requestTreatyTermination(treatyId, myCountry.id);
    if (res.ok) {
      showToast("Karşı devlete anlaşmayı cezasız feshetme isteği gönderildi.");
    } else {
      showToast(res.reason || "İstek gönderilemedi.");
    }
  }, [myCountry, showToast]);

  const handleCancelTerminationRequest = useCallback((treatyId) => {
    const eng = engineRef.current;
    if (!eng || !myCountry) return;
    eng.cancelTreatyTerminationRequest(treatyId, myCountry.id);
    showToast("Fesih isteği geri çekildi.");
  }, [myCountry, showToast]);

  const handleAcceptTreatyTermination = useCallback((treatyId) => {
    const eng = engineRef.current;
    if (!eng || !myCountry) return;
    const res = eng.acceptTreatyTermination(treatyId, myCountry.id);
    if (res.ok) {
      showToast("Anlaşma karşılıklı rıza ile cezasız olarak feshedildi!");
    } else {
      showToast(res.reason || "Hata oluştu.");
    }
  }, [myCountry, showToast]);

  const handleRejectTreatyTermination = useCallback((treatyId) => {
    const eng = engineRef.current;
    if (!eng || !myCountry) return;
    eng.rejectTreatyTermination(treatyId, myCountry.id);
    showToast("Fesih isteği reddedildi. Anlaşma geçerliliğini koruyor.");
  }, [myCountry, showToast]);

  const handleCancelTreaty = useCallback((treatyId) => {
    const eng = engineRef.current;
    if (!eng || !myCountry) return;
    const treaty = eng.treaties.find((t) => t.id === treatyId);
    if (!treaty) return;
    const penalty = treaty.penalty || 0;
    const myGold = Math.floor(myCountry.gold || 0);
    const debt = Math.max(0, penalty - myGold);
    const confirmMsg =
      debt > 0
        ? `DİKKAT! Bu anlaşmayı tek taraflı feshederseniz kasadaki ${myGold} Altın ödenecek, kalan ${debt} Altın borç kapanana kadar ürettiğiniz tüm altınlar mağdur devlete aktarılacaktır. Onaylıyor musunuz?`
        : `DİKKAT! Bu anlaşmayı tek taraflı feshederseniz ${penalty} Altın ceza ödeyeceksiniz. Onaylıyor musunuz?`;
    if (window.confirm(confirmMsg)) {
      const res = eng.breakTreaty(treatyId, myCountry.id, "FESİH");
      if (res.ok) {
        if (res.debt > 0) {
          showToast(
            `Anlaşma feshedildi! Kasadaki ${res.deducted} Altın ödendi, kalan ${res.debt} Altın borç üretimden kesilecek.`,
          );
        } else {
          showToast(`Anlaşma feshedildi. ${res.deducted} Altın ceza ödendi.`);
        }
      }
    }
  }, [myCountry, showToast]);

  const handleConfirmTreatyBreakAndAttack = useCallback(() => {
    if (!treatyWarningModal) return;
    const eng = engineRef.current;
    if (!eng || !myCountry) return;
    const { x, y, treaty } = treatyWarningModal;
    const resBreak = eng.breakTreaty(treaty.id, myCountry.id, "SALDIRI");
    if (resBreak.ok) {
      if (resBreak.debt > 0) {
        showToast(
          `Anlaşma bozuldu! Kasadaki ${resBreak.deducted} Altın ödendi. Kalan ${resBreak.debt} Altın borç üretimden kesilecek.`,
        );
      } else {
        showToast(`Anlaşma bozuldu! ${resBreak.deducted} Altın ceza ödendi.`);
      }
      eng.conquerPixel(myCountry.id, x, y);
    }
    setTreatyWarningModal(null);
  }, [treatyWarningModal, myCountry, showToast]);

  const handleBuyUpgrade = useCallback(
    (key) => {
      const eng = engineRef.current;
      const myC = eng?.getMyCountry();
      if (!eng || !myC) return;
      const res = eng.buyUpgrade(myC.id, key);
      if (!res.ok) {
        showToast(res.reason);
      }
    },
    [showToast],
  );

  const handleUndo = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const res = eng.undoLastConquest();
    if (!res.ok) {
      showToast(res.reason);
    }
  }, [showToast]);

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden bg-slate-950 text-white select-none touch-none"
      style={{ height: "100dvh", width: "100vw" }}
    >
      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      {/* Hidden File Input for Dynamic Flag Update */}
      <input
        ref={updateFlagInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpdateFlagFile}
        className="hidden"
      />

      {/* SLEEK COMPACT TOP BAR (ERGONOMIC FOR MOBILE PORTRAIT, LANDSCAPE & DESKTOP) */}
      <div
        className="absolute top-2 sm:top-3 left-2 right-2 sm:left-4 sm:right-4 flex items-center justify-between gap-1.5 pointer-events-none z-20"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Left Country Status Pill */}
        <div className="pointer-events-auto bg-slate-900/92 border border-slate-700/80 backdrop-blur-md rounded-2xl px-2 py-1.5 shadow-2xl flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={onReturnToModeSelect}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 flex items-center justify-center transition shrink-0"
            title="Menüye Dön"
          >
            <ArrowLeft size={16} />
          </button>

          {myCountry ? (
            <div className="flex items-center gap-2 shrink-0">
              {/* Flag & Country Name */}
              <div className="flex items-center gap-1.5">
                <div
                  onClick={() => updateFlagInputRef.current?.click()}
                  className="w-7 h-5 sm:w-8 sm:h-5.5 rounded overflow-hidden border-2 shadow shrink-0 bg-slate-950 cursor-pointer hover:scale-110 active:scale-95 transition"
                  style={{ borderColor: myCountry.color || "#FBBF24" }}
                  title="Resmi / Bayrağı Değiştir (Tıkla)"
                >
                  {myCountry.flagDataUrl ? (
                    <img
                      src={myCountry.flagDataUrl}
                      alt="Bayrak"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ backgroundColor: myCountry.color || "#38BDF8" }}
                    />
                  )}
                </div>
                <span className="text-[11px] sm:text-sm font-black text-white tracking-tight truncate max-w-[90px] sm:max-w-[160px]">
                  {myCountry.name}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-amber-400 pr-1 truncate">
              <Sparkles size={14} className="shrink-0" />
              <span className="truncate">Gri piksele dokunup devlet kur!</span>
            </div>
          )}
        </div>

        {/* Right Compact Action Buttons */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
          {myCountry && (
            <button
              onClick={() => setShowStatsModal(true)}
              className="px-2 sm:px-2.5 h-9 rounded-xl bg-slate-900/92 border border-sky-500/50 text-sky-300 hover:bg-slate-800 active:scale-95 font-black text-[11px] sm:text-xs flex items-center gap-1.5 shadow-xl transition"
              title="Ayrıntılı Devlet İstatistikleri"
            >
              <BarChart2 size={15} />
              <span className="hidden xs:inline sm:inline">İstatistikler</span>
            </button>
          )}

          {myCountry && (
            <button
              onClick={() => setShowQuestsModal(true)}
              className="relative px-2 sm:px-2.5 h-9 rounded-xl bg-slate-900/92 border border-amber-500/50 text-amber-300 hover:bg-slate-800 active:scale-95 font-black text-[11px] sm:text-xs flex items-center gap-1.5 shadow-xl transition"
              title="Dinamik Görevler & Ödüller"
            >
              <Award size={15} />
              <span className="hidden xs:inline sm:inline">Görevler</span>
              {engineRef.current?.getQuests().some((q) => q.completed) && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
          )}

          {networkInfo.isAdmin && (
            <button
              onClick={() => setShowAdminModal(true)}
              className="px-2 sm:px-2.5 h-9 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 active:scale-95 text-white font-black text-[11px] sm:text-xs flex items-center gap-1 shadow-xl transition"
              title="Admin Yönetim Paneli"
            >
              <Crown size={14} />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}

          <button
            onClick={() => setShowCountriesList(true)}
            className="px-2 sm:px-2.5 h-9 rounded-xl bg-slate-900/92 border border-emerald-500/45 text-emerald-300 hover:bg-slate-800 active:scale-95 font-black text-[11px] sm:text-xs flex items-center gap-1 shadow-xl transition"
            title="Haritadaki tüm devletleri gör"
          >
            <Globe size={15} />
            <span>{hud.totalCountriesCount}</span>
          </button>

          {myCountry && (
            <button
              onClick={() => {
                setShowDiplomacyModal(true);
                if (pendingIncomingCount > 0) {
                  setDiplomacyTab("INCOMING");
                }
              }}
              className="relative px-2.5 sm:px-3 h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 active:scale-95 text-white font-black text-[11px] sm:text-xs flex items-center gap-1.5 shadow-xl transition"
              title="Diplomasi & Anlaşmalar (İttifak, Haraç)"
            >
              <Handshake size={15} />
              <span className="hidden xs:inline sm:inline">Anlaşma</span>
              {pendingIncomingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center animate-bounce shadow-md">
                  {pendingIncomingCount}
                </span>
              )}
            </button>
          )}

          {myCountry && (
            <button
              onClick={() => {
                setMarketTab("STORE");
                setShowMarket(true);
              }}
              className="relative px-2.5 sm:px-3 h-9 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-[11px] sm:text-xs flex items-center gap-1.5 shadow-xl transition"
              title="Market, Geliştirmeler & Envanter"
            >
              <ShoppingBag size={15} />
              <span className="hidden xs:inline sm:inline">Market</span>
              {(myCountry.inventory?.nukes || 0) > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-rose-600 text-white text-[9px] font-black rounded-full border border-slate-900 shadow animate-pulse">
                  N{myCountry.inventory.nukes}
                </span>
              )}
            </button>
          )}

          {myCountry && (
            <button
              onClick={() => {
                setAutoConquer((prev) => {
                  const next = !prev;
                  showToast(
                    next
                      ? "Otomatik Fetih Açıldı! (Boş topraklar otomatik fethediliyor)"
                      : "Otomatik Fetih Durduruldu.",
                  );
                  return next;
                });
              }}
              className={`px-2.5 sm:px-3 h-9 rounded-xl font-black text-[11px] sm:text-xs flex items-center gap-1.5 shadow-xl transition active:scale-95 ${
                autoConquer
                  ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-amber-400/50 border border-yellow-300 ring-2 ring-yellow-400/50"
                  : "bg-slate-900/92 border border-amber-500/35 text-amber-300 hover:bg-slate-800 hover:text-white"
              }`}
              title={
                autoConquer
                  ? "Otomatik Fetih Açık (Durdurmak için dokun)"
                  : "Otomatik Fetih (Sürekli boş toprakları fetheder)"
              }
            >
              <Zap size={14} className={autoConquer ? "text-slate-950 animate-bounce" : "text-amber-400"} />
              <span className="hidden xs:inline sm:inline">Oto Fethet</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  autoConquer ? "bg-red-600 animate-ping" : "bg-slate-600"
                }`}
              />
            </button>
          )}

          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-800 active:scale-95 transition shadow"
            title={soundEnabled ? "Sesi Kapat" : "Sesi Aç"}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          <button
            onClick={() => setShowRules(true)}
            className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-800 active:scale-95 transition shadow"
            title="Kurallar & Ayarlar"
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </div>

      {/* GLOBAL CHAT (SOL ALT KÖŞE — STANDART MMO/RTS CHAT KONUMU, HARİTAYI VEYA ÜST BARI ASLA KAPATMAZ) */}
      <div
        className={`absolute bottom-[72px] sm:bottom-4 left-2 sm:left-4 z-20 flex flex-col pointer-events-none transition-all ${
          chatMinimized ? "w-auto" : "w-[86vw] max-w-[310px] sm:max-w-xs"
        }`}
      >
        <div className="pointer-events-auto bg-slate-900/92 border border-slate-700/80 backdrop-blur-md rounded-2xl p-2 shadow-2xl transition">
          {/* Header / Toggle Pill */}
          <button
            type="button"
            onClick={() => setChatMinimized((prev) => !prev)}
            className={`w-full flex items-center justify-between gap-2 ${
              chatMinimized ? "" : "pb-1.5 border-b border-slate-700/60 mb-1.5"
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
              <MessageSquare size={14} className="text-amber-400 shrink-0" />
              <span>{chatMinimized ? "Sohbet" : "Global Sohbet"}</span>
              {chatMinimized && chatMessages.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300 font-bold">
                  {chatMessages.length}
                </span>
              )}
              <span
                className={`w-2 h-2 rounded-full ml-0.5 shrink-0 ${
                  hud.isCloudConnected
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-amber-400 animate-ping"
                }`}
                title={
                  hud.isCloudConnected
                    ? "Sunucuya Bağlı"
                    : "Sunucuya Bağlanıyor..."
                }
              />
            </div>
            <span className="p-0.5 rounded-lg bg-slate-800 text-slate-300">
              {chatMinimized ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronUp size={14} />
              )}
            </span>
          </button>

          {!chatMinimized && (
            <>
              {/* Message List */}
              <div className="max-h-36 sm:max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {chatMessages.length === 0 ? (
                  <div className="text-[11px] text-slate-400 italic py-2 text-center">
                    Henüz mesaj yok. İlk mesajı sen gönder!
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const liveCountry = msg.countryId
                      ? engineRef.current?.countryMap.get(msg.countryId)
                      : null;
                    const liveRank = liveCountry
                      ? engineRef.current?.getCountryTitle(liveCountry)
                      : null;
                    const titleText = msg.countryTitle || liveRank?.title || null;
                    const titleBadge = msg.countryTitleBadge || liveRank?.badge || "";

                    return (
                    <div
                      key={msg.id}
                      className={`p-1.5 rounded-xl border flex flex-col gap-0.5 ${
                        msg.isAdmin
                          ? "bg-amber-500/15 border-amber-500/50"
                          : "bg-slate-800/75 border-slate-700/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          {msg.flagDataUrl ? (
                            <img
                              src={msg.flagDataUrl}
                              alt=""
                              className="w-4 h-3 rounded-sm object-cover shrink-0 border"
                              style={{
                                borderColor: msg.countryColor || "#FBBF24",
                              }}
                            />
                          ) : (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: msg.countryColor || "#38BDF8",
                              }}
                            />
                          )}
                          {msg.isAdmin && (
                            <span className="px-1 py-0.2 rounded bg-gradient-to-r from-rose-600 to-amber-500 text-white font-black text-[8px] shrink-0">
                              ADMIN
                            </span>
                          )}
                          {msg.isRichest && (
                            <span className="px-1.5 py-0.2 rounded-md bg-gradient-to-r from-amber-500/25 to-yellow-500/35 border border-amber-400/50 text-amber-300 font-black text-[8px] flex items-center gap-0.5 shrink-0 animate-pulse shadow-sm">
                              <Crown size={9} className="text-amber-400" />
                              <span>En Zengin</span>
                            </span>
                          )}
                          {titleText && (
                            <span className="px-1.5 py-0.2 rounded-md bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 font-extrabold text-[8px] flex items-center gap-0.5 shrink-0">
                              <span>{titleBadge}</span>
                              <span>{titleText}</span>
                            </span>
                          )}
                          <span
                            className="font-black truncate max-w-[120px]"
                            style={{ color: msg.countryColor || "#FBBF24" }}
                          >
                            {msg.countryName}
                          </span>
                        </div>
                        <span className="text-slate-400 text-[9px] shrink-0">
                          {new Date(msg.time || Date.now()).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-100 break-words pl-4">
                        {msg.text}
                      </div>
                    </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Form */}
              <form
                onSubmit={handleSendChatMessage}
                className="mt-2 flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    myCountry
                      ? `${myCountry.name} olarak yaz...`
                      : "Mesaj yaz..."
                  }
                  maxLength={140}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 flex items-center justify-center transition shrink-0"
                  title="Gönder"
                >
                  <Send size={15} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* FLOATING CAMERA CONTROLS (ERGONOMIC 44px THUMB TARGETS) */}
      <div className="absolute right-2.5 sm:right-4 bottom-24 sm:bottom-24 flex flex-col gap-2 z-10">
        <button
          onClick={() => handleZoom(1.45)}
          className="w-11 h-11 rounded-2xl bg-slate-900/92 border border-slate-700/90 text-slate-100 flex items-center justify-center hover:bg-slate-800 active:scale-90 shadow-2xl transition"
          title="Yakınlaştır"
        >
          <ZoomIn size={20} />
        </button>
        <button
          onClick={() => handleZoom(0.7)}
          className="w-11 h-11 rounded-2xl bg-slate-900/92 border border-slate-700/90 text-slate-100 flex items-center justify-center hover:bg-slate-800 active:scale-90 shadow-2xl transition"
          title="Uzaklaştır"
        >
          <ZoomOut size={20} />
        </button>
        <button
          onClick={() => {
            const eng = engineRef.current;
            if (myCountry && eng) {
              const center = eng.getCountryCenter(myCountry.id);
              centerOnCoords(center.x, center.y, 16.0);
            } else {
              centerOnCoords(550, 175, 2.8);
            }
          }}
          className="w-11 h-11 rounded-2xl bg-slate-900/92 border border-amber-500/50 text-amber-400 flex items-center justify-center hover:bg-slate-800 active:scale-90 shadow-2xl transition"
          title="Ülkeme Odaklan"
        >
          <Compass size={20} />
        </button>
      </div>

      {/* ERGONOMIC BOTTOM ACTION DOCK (SAFE-AREA LOCKED FOR MOBILE WEB & ANDROID APK) */}
      <div
        className="absolute bottom-2.5 sm:bottom-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-2.5 pointer-events-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="pointer-events-auto bg-slate-900/95 border border-slate-700/90 backdrop-blur-xl rounded-2xl p-1.5 shadow-2xl flex items-center justify-between gap-1.5">
          <button
            onClick={() => setToolMode("CONQUER")}
            className={`flex-1 min-h-[44px] px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition ${
              toolMode === "CONQUER"
                ? "bg-amber-500 text-slate-950 shadow-lg"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <LogoSwords size={16} />
            <span>Fethet</span>
          </button>

          {myCountry && (
            <>
              <button
                onClick={() => {
                  const eng = engineRef.current;
                  if (!eng) return;
                  const res = eng.conquerNextBorderPixel(myCountry.id, true);
                  if (!res.ok && res.reason) {
                    showToast(res.reason);
                  }
                }}
                className="min-h-[44px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-lg transition shrink-0"
                title="Sınırındaki boş (tarafsız) toprağı tek dokunuşla fetheder (Devletlere saldırmaz)"
              >
                <LogoTerritory size={15} />
                <span>+1</span>
              </button>

              <button
                onClick={() => {
                  const eng = engineRef.current;
                  if (!eng) return;
                  let count = 0;
                  for (let i = 0; i < 5; i++) {
                    const res = eng.conquerNextBorderPixel(myCountry.id, true);
                    if (res.ok) count++;
                    else {
                      if (count === 0 && res.reason) showToast(res.reason);
                      break;
                    }
                  }
                }}
                className="min-h-[44px] px-3 rounded-xl bg-teal-400 hover:bg-teal-300 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-lg transition shrink-0"
                title="Sınırındaki 5 boş (tarafsız) toprağı hızlıca fetheder (Devletlere saldırmaz)"
              >
                <span>+5</span>
              </button>

              {hud.canUndo && hud.undoSeconds > 0 && (
                <button
                  onClick={handleUndo}
                  className="min-h-[44px] px-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-lg transition animate-pulse shrink-0"
                  title="Son 5 saniye içinde fethettiğin pikseli geri al"
                >
                  <RotateCcw size={15} />
                  <span>{hud.undoSeconds}s</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={() => setToolMode("PAN")}
            className={`flex-1 min-h-[44px] px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition ${
              toolMode === "PAN"
                ? "bg-indigo-500 text-white shadow-lg"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <LogoPan size={16} />
            <span>Kaydır</span>
          </button>
        </div>
      </div>

      {/* FULLSCREEN VIEWPORT CANVAS */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          hoveredPosRef.current = null;
        }}
        className="w-full h-full cursor-crosshair touch-none"
      />

      {/* COUNTRIES LIST & JUMP-TO-MAP / CLAIM COUNTRY MODAL */}
      {showCountriesList && (
        <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-4 sm:p-5 shadow-2xl text-left">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <Globe size={18} className="text-emerald-400" />
                  <span>Haritadaki Devletler ({hud.totalCountriesCount})</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Haritadaki tüm aktif devletleri görebilir ve devlete
                  tıklayarak kamerasını odaklayabilirsin.
                </p>
              </div>
              <button
                onClick={() => setShowCountriesList(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {(() => {
                const uniqueCountries = [];
                const seenIds = new Set();
                for (const c of hud.allCountries || []) {
                  if (c.landCount > 0 && !seenIds.has(c.id)) {
                    seenIds.add(c.id);
                    uniqueCountries.push(c);
                  }
                }
                return uniqueCountries
                  .sort((a, b) => b.landCount - a.landCount)
                  .map((c) => {
                    const isMine = myCountry && c.id === myCountry.id;
                    const now = Date.now();
                    const lastInput = isMine
                      ? (engineRef.current?.lastInputTime || c.lastInputTime || now)
                      : (c.lastInputTime || 0);
                    const lastHeartbeat = isMine ? now : (c.lastHeartbeatTime || c._lastStatsTime || c._lastSyncTime || 0);

                    // 5 minutes = 300,000 ms
                    const isActive = (now - lastInput) < 300000;
                    // Site open / heartbeat within last 75 seconds = connected
                    const isSiteOpen = (now - lastHeartbeat) < 75000;

                    let statusLabel = "Aktif Değil";
                    let statusColor = "bg-slate-500 text-slate-300";
                    let dotColor = "bg-slate-500";

                    if (isActive) {
                      statusLabel = "Aktif";
                      statusColor = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
                      dotColor = "bg-emerald-400";
                    } else if (isSiteOpen) {
                      statusLabel = "Uzakta";
                      statusColor = "bg-amber-500/20 text-amber-300 border border-amber-500/40";
                      dotColor = "bg-amber-400";
                    } else {
                      statusLabel = "Aktif Değil";
                      statusColor = "bg-slate-700/60 text-slate-400 border border-slate-600/50";
                      dotColor = "bg-slate-500";
                    }

                    return (
                      <div
                        key={c.id}
                        className={`p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                          isMine
                            ? "bg-amber-500/10 border-amber-500/50"
                            : "bg-slate-800/80 border-slate-700/80"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            onClick={() => {
                              if (c.flagDataUrl) {
                                setPhotoPreviewModal({
                                  url: c.flagDataUrl,
                                  name: c.name,
                                  color: c.color,
                                });
                              }
                            }}
                            className={`w-8 h-6 rounded overflow-hidden border-2 shrink-0 bg-slate-950 ${c.flagDataUrl ? "cursor-pointer hover:scale-110 active:scale-95 transition" : ""}`}
                            style={{ borderColor: c.color || "#FBBF24" }}
                            title={c.flagDataUrl ? "Büyük Fotoğrafı Gör" : undefined}
                          >
                            {c.flagDataUrl && (
                              <img
                                src={c.flagDataUrl}
                                alt={c.name}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-xs text-white flex items-center gap-1.5 truncate">
                              <span className="truncate">{c.name}</span>
                              {isMine && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black shrink-0">
                                  SEN
                                </span>
                              )}
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${statusColor}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                {statusLabel}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-bold">
                              {c.landCount} Piksel • {Math.floor(c.troops)}/
                              {c.capacity} Asker
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              const eng = engineRef.current;
                              if (eng) {
                                const center = eng.getCountryCenter(c.id);
                                centerOnCoords(center.x, center.y, 16.0);
                                setShowCountriesList(false);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] transition shadow"
                          >
                            Yaklaş
                          </button>
                        </div>
                      </div>
                    );
                  });
              })()}

              {(!hud.allCountries || hud.allCountries.length === 0) && (
                <div className="p-6 text-center text-xs text-slate-400">
                  Henüz haritada kurulmuş bir devlet yok. Gri bir piksele
                  dokunarak ilk devleti kur!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DETAILED COUNTRY STATISTICS MODAL */}
      {showStatsModal && myCountry && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-2xl text-left max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-7 rounded-lg overflow-hidden border-2 shadow shrink-0 bg-slate-950"
                  style={{ borderColor: myCountry.color || "#FBBF24" }}
                >
                  {myCountry.flagDataUrl ? (
                    <img
                      src={myCountry.flagDataUrl}
                      alt={myCountry.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ backgroundColor: myCountry.color || "#38BDF8" }}
                    />
                  )}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>{myCountry.name}</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Aktif
                    </span>
                    {(() => {
                      const titleInfo = engineRef.current?.getCountryTitle(myCountry);
                      if (!titleInfo) return null;
                      return (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <span>{titleInfo.badge}</span>
                          <span>{titleInfo.title}</span>
                        </span>
                      );
                    })()}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Ayrıntılı Askeri, Ekonomik ve Nüfus Raporu
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStatsModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="space-y-4 overflow-y-auto pr-1">
              {/* Askeri Güç & Ordu */}
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/70 rounded-2xl">
                <div className="flex items-center gap-2 text-amber-400 font-black text-xs sm:text-sm mb-2.5">
                  <LogoSwords size={16} />
                  <span>Askeri Durum & Kışla</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-left">
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold">Mevcut Normal Asker</div>
                    <div className="text-sm sm:text-base font-black text-amber-300">
                      {Math.floor(myCountry.troops)} <span className="text-[10px] text-slate-400">/ {myCountry.capacity}</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-purple-500/40">
                    <div className="text-[10px] text-purple-300 font-bold">Özel Asker (Muhafız)</div>
                    <div className="text-sm sm:text-base font-black text-purple-400">
                      {(myCountry.specialTroops || 0).toLocaleString()} <span className="text-[10px] text-slate-400">(Sınırsız)</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold">Üretim Hızı</div>
                    <div className="text-sm sm:text-base font-black text-emerald-400">
                      +{(myCountry.productionRate || 0).toFixed(2)} <span className="text-[10px] text-slate-400">/sn</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold">Çevrimdışı Hız (%50)</div>
                    <div className="text-sm sm:text-base font-black text-sky-400">
                      +{((myCountry.productionRate || 0) * 0.5).toFixed(2)} <span className="text-[10px] text-slate-400">/sn</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold">Saldırı Gücü</div>
                    <div className="text-sm sm:text-base font-black text-rose-400">
                      %{( (myCountry.attackPower || 1.0) * 100 ).toFixed(0)}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold">Savunma Dayanıklılığı</div>
                    <div className="text-sm sm:text-base font-black text-indigo-400">
                      %{( (myCountry.defensePower || 1.0) * 100 ).toFixed(0)}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold">Donanma Menzili</div>
                    <div className="text-sm sm:text-base font-black text-cyan-400">
                      {Math.round(myCountry.navalRange || 38)} px
                    </div>
                  </div>
                </div>
              </div>

              {/* Ekonomi & Vergi */}
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/70 rounded-2xl">
                <div className="flex items-center gap-2 text-amber-300 font-black text-xs sm:text-sm mb-2.5">
                  <LogoGold size={16} />
                  <span>Ekonomi & Vergi Hazinesi</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-left">
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold">Kasadaki Altın</div>
                    <div className="text-sm sm:text-base font-black text-amber-300">
                      {Math.floor(myCountry.gold || 0)}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold">Altın Geliri</div>
                    {engineRef.current?.getActiveReparationDebts(myCountry.id)?.length > 0 ? (
                      <div className="text-xs sm:text-sm font-black text-rose-400">
                        Borca Kesiliyor
                      </div>
                    ) : (
                      <div className="text-sm sm:text-base font-black text-amber-400">
                        +{(myCountry.goldIncome || 0).toFixed(2)} <span className="text-[10px] text-slate-400">/sn</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold">Çevrimdışı Altın (%50)</div>
                    <div className="text-sm sm:text-base font-black text-sky-400">
                      +{((myCountry.goldIncome || 0) * 0.5).toFixed(2)} <span className="text-[10px] text-slate-400">/sn</span>
                    </div>
                  </div>
                </div>
                {engineRef.current?.getActiveReparationDebts(myCountry.id)?.length > 0 && (
                  <div className="mt-2.5 p-2 rounded-xl bg-rose-950/50 border border-rose-500/40 text-[11px] text-rose-300 font-medium">
                    ⚠️ Aktif tazminat borcunuz bulunmaktadır. Ürettiğiniz tüm altınlar borç kapanana kadar mağdur devlete aktarılmaktadır.
                  </div>
                )}
              </div>

              {/* Toprak & Nüfus */}
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/70 rounded-2xl">
                <div className="flex items-center gap-2 text-sky-300 font-black text-xs sm:text-sm mb-2.5">
                  <LogoPopulation size={16} />
                  <span>Toprak & Nüfus Dağılımı</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-left">
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold">Toplam Toprak</div>
                    <div className="text-sm sm:text-base font-black text-white">
                      {myCountry.landCount} <span className="text-[10px] text-slate-400">Piksel</span>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold">Halk Nüfusu</div>
                    <div className="text-sm sm:text-base font-black text-sky-300">
                      {Math.floor(myCountry.population || 15)} <span className="text-[10px] text-slate-400">/ {myCountry.maxPopulation}</span>
                    </div>
                    <div className="text-[10px] font-bold text-emerald-400 mt-0.5">
                      +{(myCountry.popGrowthRate || 0).toFixed(2)} /sn
                      {myCountry.popBoostUntil > Date.now() && (
                        <span className="ml-1 px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9px]">
                          +%50 Destek
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400 font-bold">Nükleer Cephane</div>
                    <div className="text-sm sm:text-base font-black text-rose-400 flex items-center gap-1">
                      <LogoNuclear size={14} />
                      <span>{myCountry.inventory?.nukes || 0} Adet</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stratejik Kaynaklar & Tarihi Başkentler */}
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/70 rounded-2xl">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2 text-purple-300 font-black text-xs sm:text-sm">
                    <span>🏛️ Stratejik Kaynaklar & Harikalar</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">Haritada Fethedilenler</span>
                </div>
                {(() => {
                  const stratLive = engineRef.current?.getCountryStrategicCounts?.(myCountry.id) || {
                    gold: myCountry.strategicCounts?.gold || 0,
                    oil: myCountry.strategicCounts?.oil || 0,
                    wonder: myCountry.strategicCounts?.wonder || 0,
                    controlled: [],
                  };
                  const goldBoost = Math.min(48, stratLive.gold * 12);
                  const oilBoost = Math.min(48, stratLive.oil * 12);
                  const wonderBoost = Math.min(32, stratLive.wonder * 8);

                  return (
                    <div className="space-y-2.5 text-left">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 rounded-xl bg-slate-900/80 border border-amber-500/30">
                          <div className="text-[10px] text-amber-300 font-bold">🪙 Altın Madeni</div>
                          <div className="text-sm font-black text-white">
                            {stratLive.gold} <span className="text-[10px] text-emerald-400 font-bold">(+%{goldBoost})</span>
                          </div>
                          <div className="text-[9px] text-slate-400">Altın Üretimi</div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-900/80 border border-sky-500/30">
                          <div className="text-[10px] text-sky-300 font-bold">⛽ Petrol Havzası</div>
                          <div className="text-sm font-black text-white">
                            {stratLive.oil} <span className="text-[10px] text-emerald-400 font-bold">(+%{oilBoost})</span>
                          </div>
                          <div className="text-[9px] text-slate-400">Asker Üretim Hızı</div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-900/80 border border-purple-500/30">
                          <div className="text-[10px] text-purple-300 font-bold">🏛️ Başkent</div>
                          <div className="text-sm font-black text-white">
                            {stratLive.wonder} <span className="text-[10px] text-emerald-400 font-bold">(+%{wonderBoost})</span>
                          </div>
                          <div className="text-[9px] text-slate-400">Saldırı & Savunma</div>
                        </div>
                      </div>

                      {/* Canlı Hesaplanan Aktif Boost Özeti */}
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-emerald-500/20 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-black text-emerald-300 text-xs border-b border-emerald-500/20 pb-1">
                          <span>⚡ Mevcut Aktif Boostlar (Canlı):</span>
                          <span className="text-[10px] text-slate-400 font-normal">Piksel bazlı hesaplanır</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 pt-0.5 text-[10px]">
                          <div className="text-amber-200">
                            💰 Altın Boostu: <span className="font-bold text-emerald-400">+{goldBoost}%</span>
                          </div>
                          <div className="text-sky-200">
                            🪖 Asker Üretim Boostu: <span className="font-bold text-emerald-400">+{oilBoost}%</span>
                          </div>
                          <div className="text-purple-200">
                            ⚔️ Savaş Gücü: <span className="font-bold text-emerald-400">+{wonderBoost}%</span>
                          </div>
                        </div>
                        {stratLive.controlled && stratLive.controlled.length > 0 ? (
                          <div className="pt-1 text-[10px] text-slate-300 flex flex-wrap gap-1 items-center">
                            <span className="text-slate-400 font-bold">Kontrol Edilen Noktalar:</span>
                            {stratLive.controlled.map((node) => (
                              <span
                                key={node.id}
                                className="px-1.5 py-0.5 rounded-md bg-purple-900/50 border border-purple-500/30 text-purple-200 text-[9px] font-bold"
                              >
                                {node.type === "GOLD" ? "🪙" : node.type === "OIL" ? "⛽" : "🏛️"} {node.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="pt-1 text-[10px] text-slate-400 italic">
                            Henüz stratejik kaynak veya tarihi başkent toprağı fethedilmedi. Haritadaki simgeleri ele geçirerek bu boostları açabilirsiniz!
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Devlet Doktrini Seçimi */}
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/70 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-amber-300 font-black text-xs sm:text-sm">
                    ⚖️ Devlet Doktrini (Strateji Rolü)
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">12 saatte 1 ücretsiz</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DOCTRINE_DEFINITIONS.map((doc) => {
                    const isActive = (myCountry.doctrine || "BALANCED") === doc.key;
                    return (
                      <button
                        key={doc.key}
                        onClick={() => {
                          if (isActive) return;
                          const res = engineRef.current?.setCountryDoctrine(myCountry.id, doc.key);
                          if (!res?.ok) {
                            showToast(res?.reason || "Doktrin değiştirilemedi.");
                          } else {
                            showToast(`${doc.icon} ${doc.name} doktrinine geçildi!`);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          isActive
                            ? "bg-amber-500/15 border-amber-400 shadow"
                            : "bg-slate-900/80 border-slate-700/70 hover:border-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-black text-xs text-white flex items-center gap-1.5">
                            <span>{doc.icon}</span>
                            <span>{doc.name}</span>
                          </span>
                          {isActive && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                              AKTİF
                            </span>
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {doc.pros.map((p, i) => (
                            <div key={i} className="text-[10px] text-emerald-400 font-bold">+ {p}</div>
                          ))}
                          {doc.cons.map((cn, i) => (
                            <div key={i} className="text-[10px] text-rose-400 font-bold">- {cn}</div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Close */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowStatsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO PREVIEW & ENLARGED MODAL */}
      {photoPreviewModal && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="relative max-w-lg w-full bg-slate-900 border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col items-center">
            {/* Close Button "X" */}
            <button
              onClick={() => setPhotoPreviewModal(null)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-slate-800/90 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center transition shadow-lg z-10"
              title="Kapat"
            >
              <X size={20} />
            </button>

            {/* Country Title */}
            <div className="w-full text-left mb-3 pr-10">
              <h3 className="text-base sm:text-lg font-black text-white truncate">
                {photoPreviewModal.name || "Devlet Bayrağı"}
              </h3>
              <p className="text-[11px] text-slate-400">
                Devletin yüklediği yüksek çözünürlüklü resmi
              </p>
            </div>

            {/* Enlarged Photo Container */}
            <div
              className="w-full max-h-[65vh] flex items-center justify-center rounded-2xl overflow-hidden border-2 bg-slate-950 shadow-2xl"
              style={{ borderColor: photoPreviewModal.color || "#FBBF24" }}
            >
              <img
                src={photoPreviewModal.url}
                alt={photoPreviewModal.name || "Devlet Resmi"}
                className="w-full h-auto max-h-[60vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* COLLECTIBLE OFFLINE PACKAGE CHEST MODAL */}
      {offlinePackageModal && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative max-w-md w-full bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-5 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center text-3xl mb-3 shadow-inner">
              🎁
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white">
              Hükümdar Hoş Geldin!
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xs">
              Sen yokken ({offlinePackageModal.timeStr}) ordun ve halkın boş durmadı. Biriken kaynaklar sandığında toplandı!
            </p>

            <div className="w-full grid grid-cols-2 gap-3 my-4">
              <div className="p-3 rounded-2xl bg-slate-800/90 border border-amber-500/40 text-left">
                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <LogoSwords size={12} className="text-amber-400" />
                  <span>Kışla Üretimi</span>
                </div>
                <div className="text-lg font-black text-amber-300 mt-0.5">
                  +{offlinePackageModal.troops} Asker
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/90 border border-amber-500/40 text-left">
                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <LogoGold size={12} className="text-amber-400" />
                  <span>Vergi Geliri</span>
                </div>
                <div className="text-lg font-black text-amber-400 mt-0.5">
                  +{offlinePackageModal.gold} Altın
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                engineRef.current?.claimOfflinePackage(offlinePackageModal);
                setOfflinePackageModal(null);
                const streak = engineRef.current?.getDailyStreakInfo();
                if (streak && !streak.isClaimedToday) {
                  setDailyStreakModal(streak);
                }
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-black text-sm shadow-xl transition flex items-center justify-center gap-2"
            >
              <span>🎁 Hazineye Aktar ve Başla</span>
            </button>
          </div>
        </div>
      )}

      {/* DAILY STREAK MODAL */}
      {dailyStreakModal && !offlinePackageModal && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative max-w-md w-full bg-slate-900 border-2 border-orange-500/80 rounded-3xl p-5 shadow-2xl flex flex-col items-center text-center">
            <button
              onClick={() => setDailyStreakModal(null)}
              className="absolute top-3 right-3 p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
            <div className="w-16 h-16 rounded-2xl bg-orange-500/20 border-2 border-orange-500/50 flex items-center justify-center text-3xl mb-3 shadow-inner">
              🔥
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-1.5">
              <span>Günlük Giriş Serisi</span>
              <span className="text-orange-400">({dailyStreakModal.nextStreak}. Gün)</span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xs">
              Her gün oyuna girerek serini koru, ekstra altın ve 24 saatlik verim bonusu kazan!
            </p>

            <div className="w-full p-3.5 my-4 rounded-2xl bg-slate-800/80 border border-orange-500/40 text-center">
              <div className="text-xs font-black text-orange-300">
                Günün Ödülü: +{dailyStreakModal.bonusGold} Altın & +%{dailyStreakModal.bonusPercent} Günlük Verim
              </div>
            </div>

            <button
              onClick={() => {
                engineRef.current?.claimDailyStreak();
                setDailyStreakModal(null);
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 active:scale-95 text-slate-950 font-black text-sm shadow-xl transition flex items-center justify-center gap-2"
            >
              <Flame size={18} className="fill-current" />
              <span>Günün Bonusunu Al</span>
            </button>
          </div>
        </div>
      )}

      {/* DYNAMIC QUESTS MODAL */}
      {showQuestsModal && myCountry && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-2xl text-left max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
                  <Award size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Dinamik Hükümdar Görevleri
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Büyüdükçe hedefler ve ödüller otomatik olarak katlanır!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuestsModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1">
              {engineRef.current?.getQuests().map((q) => {
                const percent = Math.min(100, Math.round(((q.current || 0) / q.target) * 100));

                return (
                  <div
                    key={q.id}
                    className={`p-3.5 rounded-2xl border transition ${
                      q.completed
                        ? "bg-emerald-950/30 border-emerald-500/60 shadow-lg"
                        : "bg-slate-800/70 border-slate-700/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="font-black text-xs sm:text-sm text-white">
                        {q.title}
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-amber-300">
                        {Math.min(q.target, q.current || 0)} / {q.target}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2">
                      {q.desc}
                    </p>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden mb-2.5 border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          q.completed ? "bg-emerald-400" : "bg-amber-500"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-700/40">
                      <div className="text-[11px] font-bold text-slate-300 flex items-center gap-2">
                        <span>Ödül:</span>
                        <span className="text-amber-400">+{q.rewardGold} Altın</span>
                        {q.rewardTroops > 0 && (
                          <span className="text-emerald-400">+{q.rewardTroops} Asker</span>
                        )}
                      </div>

                      {q.completed ? (
                        <button
                          onClick={() => {
                            engineRef.current?.claimQuestReward(q.id);
                            showToast("🏆 Görev ödülü toplandı! Yeni seviye görev atandı.");
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs transition shadow animate-bounce"
                        >
                          Ödülü Al
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-bold">
                          Devam Ediyor
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowQuestsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPGRADES MODAL */}
      {showUpgrades && myCountry && (
        <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl text-left">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <LogoCitadel size={20} />
                  <span>Devlet Geliştirmeleri (9 Dal • Max Sv.25)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <span>
                    Halkının ödediği vergilerle ({Math.floor(myCountry.gold)}{" "}
                    Altın) devletini güçlendir.
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowUpgrades(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Live Flag / Custom Image Changer */}
            <div className="mb-2.5 p-2.5 rounded-2xl bg-slate-800/70 border border-slate-700/80 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Upload size={16} className="text-amber-400" />
                <span>Devlet Resmi / Bayrağı:</span>
              </span>
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-6 rounded-lg overflow-hidden border border-slate-600 bg-slate-950 flex items-center justify-center shrink-0 shadow"
                  style={{ borderColor: myCountry.color || "#FBBF24" }}
                >
                  {myCountry.flagDataUrl ? (
                    <img
                      src={myCountry.flagDataUrl}
                      alt="Bayrak"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-500 font-bold">Yok</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => updateFlagInputRef.current?.click()}
                  className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs transition shadow flex items-center gap-1"
                >
                  <Upload size={13} />
                  <span>Resim Değiştir</span>
                </button>
              </div>
            </div>

            {/* Live Border Color Picker */}
            <div className="mb-3 p-2.5 rounded-2xl bg-slate-800/70 border border-slate-700/80 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <LogoPalette size={16} />
                <span>Sınır Rengi:</span>
              </span>
              <div className="flex items-center gap-2">
                {[
                  "#E11D48",
                  "#3B82F6",
                  "#10B981",
                  "#F59E0B",
                  "#8B5CF6",
                  "#EC4899",
                  "#06B6D4",
                  "#FFFFFF",
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      engineRef.current?.setCountryColor(myCountry.id, c);
                      showToast("Sınır rengin güncellendi!");
                    }}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full transition ${
                      myCountry.color === c
                        ? "ring-2 ring-white scale-110"
                        : "opacity-75 hover:opacity-100"
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={myCountry.color || "#E11D48"}
                  onChange={(e) =>
                    engineRef.current?.setCountryColor(
                      myCountry.id,
                      e.target.value,
                    )
                  }
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  title="Özel Sınır Rengi Seç"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
              {UPGRADE_DEFINITIONS.map((def) => {
                const lvl = myCountry.upgrades?.[def.key] || 0;
                const stars = myCountry.prestigeStars?.[def.key] || 0;
                const isMax = lvl >= def.maxLevel;
                const cost = Math.round(
                  def.baseCost * Math.pow(def.costScale, lvl),
                );
                const canAfford = myCountry.gold >= cost && !isMax;
                const canPrestige = isMax && myCountry.gold >= 15000;

                return (
                  <div
                    key={def.key}
                    className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 flex-1">
                      <div className="mt-0.5 shrink-0">
                        <UpgradeLogo upgradeKey={def.key} size={24} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-white">
                            {def.name}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                            Sv. {lvl}/{def.maxLevel}
                          </span>
                          {stars > 0 && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-0.5">
                              <Star size={10} className="fill-purple-400 text-purple-400" />
                              <span>{stars}★</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {def.desc}
                        </p>
                      </div>
                    </div>

                    {isMax ? (
                      <button
                        onClick={() => {
                          const res = engineRef.current?.prestigeUpgrade(myCountry.id, def.key);
                          if (!res.ok) {
                            showToast(res.reason || "Prestij yapılamadı.");
                          } else {
                            showToast(`⭐ ${def.name} Prestij Seviyesine Yükseltildi!`);
                          }
                        }}
                        className={`px-3 py-2 rounded-xl font-black text-xs shrink-0 flex items-center gap-1 transition shadow ${
                          canPrestige
                            ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white animate-pulse"
                            : "bg-slate-700/70 text-purple-300 border border-purple-500/40"
                        }`}
                        title="Seviye 25'e ulaştın! Sıfırlayıp +%2 kalıcı yıldız bonusu kazan (15.000 Altın)"
                      >
                        <Star size={13} className="fill-current" />
                        <span>Prestij Yap (15k)</span>
                      </button>
                    ) : (
                      <button
                        disabled={!canAfford}
                        onClick={() => handleBuyUpgrade(def.key)}
                        className={`px-3 py-2 rounded-xl font-black text-xs shrink-0 flex items-center gap-1 transition ${
                          canAfford
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow"
                            : "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                        }`}
                      >
                        <span>{cost}</span>
                        <LogoGold size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* FOUND COUNTRY MODAL */}
      {foundingModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <LogoCitadel size={22} />
                <span>Devletini Kur</span>
              </h3>
              <button
                onClick={() => setFoundingModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Ülke Adı
                </label>
                <input
                  type="text"
                  value={foundName}
                  onChange={(e) => setFoundName(e.target.value)}
                  placeholder="Devletinin Adını Yaz..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Özel Resim / Bayrak Yükle
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-12 rounded-xl overflow-hidden border border-slate-600 bg-slate-950 flex items-center justify-center shrink-0">
                    {foundFlagDataUrl ? (
                      <img
                        src={foundFlagDataUrl}
                        alt="Yüklenen"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-500 font-bold">
                        Resim Yok
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow flex items-center justify-center gap-1.5"
                  >
                    <Upload size={14} />
                    <span>Fotoğraf Seç</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Sınır Işıltı Rengi
                </label>
                <div className="flex items-center gap-2.5">
                  {[
                    "#E11D48",
                    "#3B82F6",
                    "#10B981",
                    "#F59E0B",
                    "#8B5CF6",
                    "#EC4899",
                    "#06B6D4",
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFoundColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full transition ${
                        foundColor === c
                          ? "ring-4 ring-white/60 scale-110"
                          : "opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={foundColor}
                    onChange={(e) => setFoundColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                    title="Özel Sınır Rengi Seç"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5">
                  <LogoTerritory size={14} />
                  <span>
                    Konum: ({foundingModal.x}, {foundingModal.y})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <LogoSwords size={14} />
                  <span>Başlangıç: 1 Piksel Toprak & 1 Asker Kapasitesi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <LogoNavy size={14} />
                  <span>
                    Denize kıyın olduğunda karşı kıyılara gemi gönderebilirsin.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmFoundCountry}
                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition shadow-xl"
              >
                Devletimi Kur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SERVER MAINTENANCE / CONNECTION BLOCKED MODAL */}
      {serverBlocked && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/80 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
              <WifiOff size={32} />
            </div>
            
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">
                Bağlantı Kurulamadı
              </h3>
              <p className="text-xs text-amber-400/90 font-bold mt-1">
                Oyun güncelleniyor yada bakım modunda belkide internet bağlantınız kötü
              </p>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 border border-slate-800 rounded-xl p-3">
              Yaptığınız fetihlerin ve değişikliklerin kaybolmaması için sunucuya bağlı olmanız gerekmektedir. Bağlantınız düzeldiğinde veya bakım bittiğinde otomatik açılacaktır.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition"
              >
                <RefreshCw size={14} />
                <span>Tekrar Dene (Yenile)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setServerBlocked(false);
                  onReturnToModeSelect();
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition active:scale-95"
              >
                Ana Menüye Dön
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VPN / PROXY WARNING BLOCKED MODAL */}
      {vpnBlocked && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-gradient-to-b from-red-950/90 to-slate-950 border-2 border-red-500 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-3xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert size={36} />
            </div>
            <h3 className="text-xl font-black text-white">
              VPN / PROXY KULLANIMI YASAK!
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Dünya haritasında çoklu hesap veya suistimalleri önlemek için VPN
              ve Proxy kullanımı yasaklanmıştır.
            </p>
            <button
              onClick={() => {
                setVpnBlocked(false);
                onReturnToModeSelect();
              }}
              className="w-full mt-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
            >
              Menüye Dön
            </button>
          </div>
        </div>
      )}

      {/* RULES MODAL */}
      {showRules && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-black text-amber-400">
                Dünya Haritası Kuralları
              </h3>
              <button
                onClick={() => setShowRules(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="font-black text-white mb-0.5 flex items-center gap-1.5">
                  <LogoSwords size={16} />
                  <span>Değerli Büyüme & Asker Üretimi</span>
                </div>
                <div>
                  Her piksel değerlidir. Ülkenin asker kapasitesi toprak
                  sayısına eşittir. Asker üretim hızı logaritmik artar; büyük
                  devletler yüksek kapasiteye sahip olurken küçük devletler de
                  üretim hızıyla onlara yetişebilir.
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="font-black text-white mb-0.5 flex items-center gap-1.5">
                  <LogoNavy size={16} />
                  <span>Deniz Aşırı Gemi Seferleri</span>
                </div>
                <div>
                  Denize kıyısı olan bir toprağın varsa, menzilin içindeki karşı
                  kıyılara veya adalara tıklayarak <b>Çıkarma Gemisi</b>{" "}
                  gönderebilirsin. Gemin denizde ilerleyip karşı kıyıya
                  ulaştığında o toprağı fetheder. <b>Donanma & Tersane</b>{" "}
                  geliştirmesiyle gemi menzilini ve hızını artırabilirsin.
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="font-black text-white mb-0.5 flex items-center gap-1.5">
                  <LogoGold size={16} />
                  <span>Halk, Altın & 25 Seviyeli Geliştirmeler</span>
                </div>
                <div>
                  Topraklarında yaşayan halk zamanla çoğalır ve hazinene
                  otomatik <b>Altın</b> vergisi öder. Biriken altınlarla 9
                  farklı geliştirme dalını 25. seviyeye kadar yükseltebilirsin.
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="font-black text-amber-400 mb-0.5 flex items-center gap-1.5">
                  <Sparkles size={16} />
                  <span>Estetik Sınırlar & Otomatik Boşluk Doldurma</span>
                </div>
                <div>
                  Devletler tek piksel çizgi çekerek yılan gibi büyüyemez;
                  sınırlarını kalınlaştırarak genişlemelisin. Etrafını
                  çevrelediğin tüm iç boşluklar otomatik olarak fethedilip
                  ülkene katılır. Yanlış fethettiğin bir pikseli alt bardaki{" "}
                  <b>Geri Al (5s)</b> butonuna basarak anında geri alabilirsin.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 transition"
            >
              Anladım
            </button>

            {myCountry && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `"${myCountry.name}" devletinin yönetimini bu cihazdan bırakmak ve haritada sıfırdan yeni bir devlet kurmak istiyor musun?`,
                    )
                  ) {
                    engineRef.current?.abandonMyCountry();
                    setShowRules(false);
                    showToast(
                      "Devlet yönetimi bırakıldı. Sahipsiz gri bir piksele dokunarak yeni devletini kurabilirsin!",
                    );
                  }
                }}
                className="w-full mt-2 py-2 rounded-xl bg-rose-500/20 border border-rose-500/50 hover:bg-rose-500/30 text-rose-300 font-bold text-[11px] transition"
              >
                Devletimi Bırak (Sıfırdan Yeni Devlet Kur)
              </button>
            )}
          </div>
        </div>
      )}

      {/* ADMIN PANEL MODAL (ONLY ACCESSIBLE FROM AUTHORIZED ADMIN IP) */}
      {showAdminModal && networkInfo.isAdmin && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/70 rounded-3xl p-4 sm:p-5 shadow-2xl text-left">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-amber-400 flex items-center gap-2">
                  <Crown size={18} className="text-amber-400" />
                  <span>Admin Yönetim Paneli</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  IP doğrulandı • Tüm işlemler anında bulut sunucusuna işlenir.
                </p>
              </div>
              <button
                onClick={() => setShowAdminModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[72vh] overflow-y-auto pr-1">
              {/* 1. SELF BOOST CONTROLS WITH CUSTOM NUMBER INPUTS */}
              {myCountry && (
                <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-3">
                  <div className="text-xs font-black text-amber-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Zap size={15} />
                      <span>Kendi Devletini Yönet & Güçlendir ({myCountry.name})</span>
                    </div>
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                      Depo: {myCountry.inventory?.nukes || 0} Nükleer
                    </span>
                  </div>

                  {/* Asker & Altın Ekleme (Elle Sayı Gir) */}
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-2">
                    <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                      <span>Asker & Altın Takviyesi</span>
                      <span className="text-[10px] text-slate-400">Mevcut: {Math.floor(myCountry.troops)} Asker / {Math.floor(myCountry.gold).toLocaleString()} Altın</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={adminCustomTroops}
                          onChange={(e) => setAdminCustomTroops(parseInt(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white font-bold text-xs"
                          placeholder="Asker sayısı"
                        />
                        <button
                          onClick={() => engineRef.current?.adminGiveResources(myCountry.id, adminCustomTroops, 0)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shrink-0"
                        >
                          +Asker
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={adminCustomGold}
                          onChange={(e) => setAdminCustomGold(parseInt(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white font-bold text-xs"
                          placeholder="Altın sayısı"
                        />
                        <button
                          onClick={() => engineRef.current?.adminGiveResources(myCountry.id, 0, adminCustomGold)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0"
                        >
                          +Altın
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Nükleer & Toprak Ekleme (Elle Sayı Gir) */}
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 space-y-2">
                    <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                      <span>Nükleer Başlık & Toprak Genişletme</span>
                      <span className="text-[10px] text-slate-400">Mevcut: {myCountry.landCount} Piksel</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={adminCustomNukes}
                          onChange={(e) => setAdminCustomNukes(parseInt(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white font-bold text-xs"
                          placeholder="Nükleer adedi"
                        />
                        <button
                          onClick={() => engineRef.current?.adminGiveNuclear(myCountry.id, adminCustomNukes)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shrink-0 flex items-center gap-1"
                        >
                          <LogoNuclear size={14} />
                          <span>+Nükleer</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={adminCustomLand}
                          onChange={(e) => setAdminCustomLand(parseInt(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-white font-bold text-xs"
                          placeholder="Toprak pikseli"
                        />
                        <button
                          onClick={() => engineRef.current?.adminAutoExpand(myCountry.id, adminCustomLand)}
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs shrink-0"
                        >
                          +Toprak
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Hızlı Butonlar */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => engineRef.current?.adminMaxUpgrades(myCountry.id)}
                      className="py-2 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition shadow flex items-center justify-center gap-1.5"
                    >
                      <LogoCitadel size={15} />
                      <span>Tüm Geliştirmeleri 25 Yap</span>
                    </button>
                    <button
                      onClick={() => updateFlagInputRef.current?.click()}
                      className="py-2 px-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs transition shadow flex items-center justify-center gap-1.5"
                    >
                      <Upload size={14} />
                      <span>Resim / Bayrak Değiştir</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 2. HARİTADAKİ DİĞER DEVLETLERİ YÖNETME (TÜM AYARLARI DÜZENLEME) */}
              <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-3">
                <div className="text-xs font-black text-white flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Globe size={15} className="text-indigo-400" />
                    <span>Haritadaki Devletleri Yönet ({hud.totalCountriesCount})</span>
                  </div>
                </div>

                {/* Hedef Devlet Seçimi */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    İşlem Yapılacak Devleti Seç:
                  </label>
                  <select
                    value={adminTargetCountryId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAdminTargetCountryId(val);
                      const target = (hud.allCountries || []).find((c) => String(c.id) === String(val));
                      if (target) {
                        setAdminTargetTroops(Math.floor(target.troops));
                        setAdminTargetGold(Math.floor(target.gold));
                        setAdminTargetNukes(target.inventory?.nukes || 0);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs"
                  >
                    <option value="">-- Devlet Seçin --</option>
                    {(hud.allCountries || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.landCount} px • {Math.floor(c.troops)} Asker • {Math.floor(c.gold).toLocaleString()} Altın • {c.inventory?.nukes || 0} Nükleer)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Seçili Devleti Yönetim Paneli */}
                {adminTargetCountryId && (() => {
                  const targetCountry = (hud.allCountries || []).find((c) => String(c.id) === String(adminTargetCountryId));
                  if (!targetCountry) return null;

                  return (
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-indigo-500/40 space-y-3 text-xs">
                      <div className="flex items-center justify-between font-black text-white">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: targetCountry.color }} />
                          <span>{targetCountry.name}</span>
                        </span>
                        <span className="text-[11px] text-indigo-300">{targetCountry.landCount} Piksel</span>
                      </div>

                      {/* Asker Düzenleme */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-300 font-bold shrink-0">Asker:</span>
                        <input
                          type="number"
                          value={adminTargetTroops}
                          onChange={(e) => setAdminTargetTroops(parseInt(e.target.value) || 0)}
                          className="flex-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-xs"
                        />
                        <button
                          onClick={() => engineRef.current?.adminGiveResources(targetCountry.id, adminTargetTroops, 0)}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                          title="Üzerine ekle"
                        >
                          +Ekle
                        </button>
                        <button
                          onClick={() => engineRef.current?.adminSetResources(targetCountry.id, adminTargetTroops, null)}
                          className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px]"
                          title="Tam bu sayıya eşitle"
                        >
                          Ayarla
                        </button>
                      </div>

                      {/* Altın Düzenleme */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-300 font-bold shrink-0">Altın:</span>
                        <input
                          type="number"
                          value={adminTargetGold}
                          onChange={(e) => setAdminTargetGold(parseInt(e.target.value) || 0)}
                          className="flex-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-xs"
                        />
                        <button
                          onClick={() => engineRef.current?.adminGiveResources(targetCountry.id, 0, adminTargetGold)}
                          className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px]"
                          title="Altın gönder"
                        >
                          +Gönder
                        </button>
                        <button
                          onClick={() => engineRef.current?.adminSetResources(targetCountry.id, null, adminTargetGold)}
                          className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px]"
                          title="Tam bu miktara eşitle"
                        >
                          Ayarla
                        </button>
                      </div>

                      {/* Nükleer Düzenleme */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-300 font-bold shrink-0">Nükleer:</span>
                        <input
                          type="number"
                          value={adminTargetNukes}
                          onChange={(e) => setAdminTargetNukes(parseInt(e.target.value) || 0)}
                          className="flex-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-xs"
                        />
                        <button
                          onClick={() => engineRef.current?.adminGiveNuclear(targetCountry.id, adminTargetNukes)}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]"
                          title="Nükleer ver"
                        >
                          +Ver
                        </button>
                        <button
                          onClick={() => engineRef.current?.adminSetNuclear(targetCountry.id, adminTargetNukes)}
                          className="px-2 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold text-[11px]"
                          title="Tam bu sayıya eşitle"
                        >
                          Ayarla
                        </button>
                      </div>

                      {/* Özel Asker (Muhafız) Gönder */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-purple-300 font-bold shrink-0">Özel Asker:</span>
                        <input
                          type="number"
                          value={adminTargetTroops}
                          onChange={(e) => setAdminTargetTroops(parseInt(e.target.value) || 0)}
                          className="flex-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-purple-500/40 text-white font-bold text-xs"
                        />
                        <button
                          onClick={() => engineRef.current?.adminGiveSpecialTroops(targetCountry.id, adminTargetTroops)}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px]"
                          title="Seçili ülkeye sınırsız kapasiteli özel asker gönder"
                        >
                          +Özel Ver
                        </button>
                      </div>

                      {/* Toprak Büyütme */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-300 font-bold shrink-0">Toprak:</span>
                        <input
                          type="number"
                          value={adminTargetLand}
                          onChange={(e) => setAdminTargetLand(parseInt(e.target.value) || 0)}
                          className="flex-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-xs"
                          placeholder="Piksel"
                        />
                        <button
                          onClick={() => engineRef.current?.adminAutoExpand(targetCountry.id, adminTargetLand)}
                          className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px]"
                        >
                          Toprağını Büyüt
                        </button>
                      </div>

                      {/* Aksiyonlar: Anlaşmaları Boz & Devleti Sil */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                        <button
                          onClick={() => engineRef.current?.adminBreakCountryTreaties(targetCountry.id)}
                          className="py-1.5 px-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white font-black text-[11px] transition"
                        >
                          Anlaşmalarını Boz
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`"${targetCountry.name}" devletini haritadan tamamen silmek istiyor musun?`)) {
                              engineRef.current?.adminDeleteCountry(targetCountry.id, true);
                              setAdminTargetCountryId("");
                            }
                          }}
                          className="py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] flex items-center justify-center gap-1 transition"
                        >
                          <Trash2 size={12} />
                          <span>Devleti Sil</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 3. GLOBAL SUNUCU AYARLARI & TOPLU İŞLEMLER */}
              <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 space-y-3">
                <div className="text-xs font-black text-rose-300 flex items-center gap-1.5">
                  <ShieldAlert size={15} />
                  <span>Global Sunucu Yönetimi & Toplu Dağıtımlar</span>
                </div>

                {/* Herkese Altın Dağıt */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={adminGlobalGold}
                    onChange={(e) => setAdminGlobalGold(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/40 text-white font-bold text-xs"
                    placeholder="Altın miktarı"
                  />
                  <button
                    onClick={() => engineRef.current?.adminGiveAllPlayersGold(adminGlobalGold)}
                    className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 transition"
                  >
                    Herkese Altın Ver
                  </button>
                </div>

                {/* Herkese Asker Dağıt */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={adminGlobalTroops}
                    onChange={(e) => setAdminGlobalTroops(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/40 text-white font-bold text-xs"
                    placeholder="Asker miktarı"
                  />
                  <button
                    onClick={() => engineRef.current?.adminGiveAllPlayersTroops(adminGlobalTroops)}
                    className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shrink-0 transition"
                  >
                    Herkese Asker Gönder
                  </button>
                </div>

                {/* Herkese Nükleer Dağıt */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={adminGlobalNukes}
                    onChange={(e) => setAdminGlobalNukes(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-rose-500/40 text-white font-bold text-xs"
                    placeholder="Nükleer adedi"
                  />
                  <button
                    onClick={() => engineRef.current?.adminGiveAllPlayersNukes(adminGlobalNukes)}
                    className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shrink-0 transition flex items-center gap-1"
                  >
                    <LogoNuclear size={14} />
                    <span>Millete Nükleer Ver</span>
                  </button>
                </div>

                {/* Herkese Özel Asker (Muhafız) Dağıt */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={adminGlobalTroops}
                    onChange={(e) => setAdminGlobalTroops(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-purple-500/40 text-white font-bold text-xs"
                    placeholder="Özel asker adedi"
                  />
                  <button
                    onClick={() => engineRef.current?.adminGiveAllPlayersSpecialTroops(adminGlobalTroops)}
                    className="py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shrink-0 transition flex items-center gap-1"
                  >
                    <LogoSwords size={14} />
                    <span>Millete Özel Asker Ver</span>
                  </button>
                </div>

                {/* Radyasyon, Sohbet & Wipe Butonları */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-rose-900/40">
                  <button
                    onClick={() => engineRef.current?.adminClearRadiation(true)}
                    className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] transition shadow"
                  >
                    Radyasyonu Temizle
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("Tüm diplomatik anlaşmalar ve savaşlar sıfırlanıp genel barış ilan edilsin mi?")) {
                        engineRef.current?.adminResetTreaties(true);
                      }
                    }}
                    className="py-2 px-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-black text-[11px] transition shadow"
                  >
                    Genel Barış İlan Et
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("Global sohbetteki tüm mesajları herkesten silmek istiyor musun?")) {
                        engineRef.current?.adminClearChat(true);
                      }
                    }}
                    className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-[11px] transition"
                  >
                    Sohbeti Temizle
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("DİKKAT! Tüm devletler, topraklar ve sohbet herkesten sıfırlanacak. Onaylıyor musun?")) {
                        engineRef.current?.adminResetWorld(true);
                        setShowAdminModal(false);
                      }
                    }}
                    className="py-2 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] transition shadow"
                  >
                    Tüm Haritayı Sıfırla (Wipe)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RED FLASHING UNDER-ATTACK VIGNETTE BORDER */}
      {underAttackAlert && (
        <div className="pointer-events-none fixed inset-0 z-40 border-[8px] sm:border-[12px] border-rose-600/80 shadow-[inset_0_0_80px_rgba(225,29,72,0.65)] animate-pulse" />
      )}

      {/* TOP UNDER-ATTACK EMERGENCY ACTION BANNER */}
      {underAttackAlert && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-rose-950/95 border-2 border-rose-500 text-rose-100 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-lg shadow-rose-600/50">
            ⚠️
          </div>
          <div className="text-left">
            <div className="text-xs font-black text-rose-200">
              {underAttackAlert.isNuke ? "🚨 NÜKLEER SALDIRI ALTINDASIN!" : "🚨 TOPRAKLARIN SALDIRI ALTINDA!"}
            </div>
            <div className="text-[10px] text-rose-300">
              {underAttackAlert.attackerName} sınırlarınıza saldırıyor!
            </div>
          </div>
          <button
            onClick={() => {
              if (Number.isFinite(underAttackAlert.x) && Number.isFinite(underAttackAlert.y)) {
                centerOnCoords(underAttackAlert.x, underAttackAlert.y, 16.0);
              }
            }}
            className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] transition shadow-lg shrink-0 active:scale-95"
          >
            Bölgeye Git
          </button>
          <button
            onClick={() => setUnderAttackAlert(null)}
            className="text-rose-400 hover:text-white text-xs px-1"
            title="Kapat"
          >
            ✕
          </button>
        </div>
      )}

      {/* WEB VERSION UPDATE FLOATING BANNER */}
      {webUpdateAvailable && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-indigo-950/95 border border-indigo-400 text-indigo-100 px-4 py-2 rounded-full shadow-2xl text-[11px] font-black flex items-center gap-2.5 animate-bounce">
          <Sparkles size={14} className="text-indigo-400 animate-spin" />
          <span>Yeni sürüm yayında! Sayfa 3 saniye içinde otomatik yenileniyor...</span>
          <button
            onClick={() => window.location.reload()}
            className="px-2.5 py-1 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white font-black text-[10px] flex items-center gap-1 transition"
          >
            <RefreshCw size={10} />
            <span>Şimdi Yenile</span>
          </button>
        </div>
      )}

      {/* OPTIONAL ANDROID UPDATE BANNER */}
      {optionalAppUpdate && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-emerald-500/60 text-emerald-100 px-3.5 py-2 rounded-2xl shadow-2xl text-[11px] font-bold flex items-center gap-3">
          <span>İsteğe bağlı APK güncellemesi: v{optionalAppUpdate.remoteVersion}</span>
          <a
            href={optionalAppUpdate.apkUrl}
            target="_system"
            rel="noreferrer"
            onClick={() => window.open(optionalAppUpdate.apkUrl, "_system")}
            className="px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black"
          >
            İndir
          </a>
          <button onClick={() => setOptionalAppUpdate(null)} aria-label="Güncelleme bildirimini kapat" className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* MANDATORY UPDATE MODAL (FORCES ANDROID APK USERS TO UPDATE TO LATEST VERSION) */}
      {mandatoryUpdate && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
              <Sparkles
                size={32}
                className="animate-spin"
                style={{ animationDuration: "6s" }}
              />
            </div>

            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black text-[10px] tracking-wider uppercase">
                Zorunlu Güncelleme
              </span>
              <h2 className="text-xl font-black text-white mt-1.5">
                Yeni Sürüm Mevcut!
              </h2>
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 mt-1">
                <span className="text-slate-400">
                  v{mandatoryUpdate.localVersion || "1.0"}
                </span>
                <span>-&gt;</span>
                <span className="text-amber-400 font-black">
                  v{mandatoryUpdate.remoteVersion}
                </span>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 text-left">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Yenilikler & Düzeltmeler:
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {mandatoryUpdate.releaseNotes}
              </p>
            </div>

            <p className="text-[11px] text-slate-400 leading-tight">
              Sunucu haritası ve oyun kuralları güncellendi. Kesintisiz
              oynayabilmek için son sürüme geçmeniz zorunludur.
            </p>

            <a
              href={mandatoryUpdate.apkUrl}
              target="_system"
              rel="noreferrer"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.open(mandatoryUpdate.apkUrl, "_system");
                }
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition"
            >
              <Download size={18} />
              <span>Hemen Güncelle (APK İndir)</span>
            </a>
          </div>
        </div>
      )}

      {/* DIPLOMACY & TREATIES MODAL (İTTİFAK & HARAÇ SİSTEMİ) */}
      {showDiplomacyModal && myCountry && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-2xl text-left flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0">
                  <Handshake size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    <span>Diplomasi & Anlaşmalar</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Diğer devletlerle ittifak kur veya haraç bağla
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDiplomacyModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/60 rounded-2xl my-3 border border-slate-800/80">
              <button
                onClick={() => setDiplomacyTab("ACTIVE")}
                className={`py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  diplomacyTab === "ACTIVE"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Shield size={14} />
                <span>Aktif Anlaşmalar</span>
              </button>

              <button
                onClick={() => setDiplomacyTab("INCOMING")}
                className={`relative py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  diplomacyTab === "INCOMING"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText size={14} />
                <span>Gelenler</span>
                {pendingIncomingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black text-[10px]">
                    {pendingIncomingCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setDiplomacyTab("NEW")}
                className={`py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  diplomacyTab === "NEW"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles size={14} />
                <span>Teklif Et</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
              {/* TAB 1: ACTIVE TREATIES & REPARATION DEBTS */}
              {diplomacyTab === "ACTIVE" && (() => {
                const activeList = treatiesList.filter(
                  (t) =>
                    t.status === "ACTIVE" &&
                    (t.fromId === myCountry.id || t.toId === myCountry.id)
                );
                const myDebts = treatiesList.filter(
                  (t) =>
                    t.status === "BROKEN" &&
                    t.debtorId === myCountry.id &&
                    (t.remainingDebt || 0) > 0.05
                );
                const myReceivables = treatiesList.filter(
                  (t) =>
                    t.status === "BROKEN" &&
                    t.creditorId === myCountry.id &&
                    (t.remainingDebt || 0) > 0.05
                );

                if (activeList.length === 0 && myDebts.length === 0 && myReceivables.length === 0) {
                  return (
                    <div className="text-center py-8 px-4 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-slate-400">
                      <Shield size={32} className="mx-auto mb-2 text-slate-600" />
                      <div className="text-xs font-bold text-slate-300">
                        Henüz aktif bir anlaşmanız veya tazminat borcunuz yok
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                        "Teklif Et" sekmesinden başka bir devlete İttifak veya Haraç teklifi gönderebilirsin.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {/* ACTIVE REPARATION DEBTS (I OWE MONEY) */}
                    {myDebts.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-black text-rose-400 flex items-center gap-1.5 px-1">
                          <Coins size={14} className="text-rose-400" />
                          <span>Ödenmekte Olan Tazminat Borçları</span>
                        </div>
                        {myDebts.map((tr) => (
                          <div
                            key={tr.id}
                            className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/50 space-y-2"
                          >
                            <div className="flex items-center justify-between text-xs font-bold text-white">
                              <span>{tr.creditorName || "Mağdur Devlet"}</span>
                              <span className="text-rose-400 font-black">
                                {Math.round(tr.remainingDebt)} Altın Borç Kaldı
                              </span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-rose-500/20">
                              <div
                                className="bg-rose-500 h-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(
                                      ((tr.paidDebt || 0) / (tr.totalDebt || 1)) * 100
                                    )
                                  )}%`,
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-rose-200/90 leading-tight">
                              ⚠️ Anlaşma ihlali nedeniyle ürettiğiniz tüm altınlar bu borç kapanana kadar otomatik olarak mağdur devlete tazminat olarak aktarılmaktadır.
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ACTIVE REPARATION RECEIVABLES (I AM OWED MONEY) */}
                    {myReceivables.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-black text-emerald-400 flex items-center gap-1.5 px-1">
                          <Coins size={14} className="text-emerald-400" />
                          <span>Tahsil Edilen Tazminat Alacakları</span>
                        </div>
                        {myReceivables.map((tr) => (
                          <div
                            key={tr.id}
                            className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 space-y-2"
                          >
                            <div className="flex items-center justify-between text-xs font-bold text-white">
                              <span>{tr.debtorName || "Hain Devlet"}</span>
                              <span className="text-emerald-400 font-black">
                                +{Math.round(tr.paidDebt || 0)} / {tr.totalDebt} Altın
                              </span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-emerald-500/20">
                              <div
                                className="bg-emerald-500 h-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(
                                      ((tr.paidDebt || 0) / (tr.totalDebt || 1)) * 100
                                    )
                                  )}%`,
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-emerald-200/90 leading-tight">
                              💰 Bu devlet anlaşmayı ihlal ettiği için ürettiği altınlar borcu ({Math.round(tr.remainingDebt)} Altın kaldı) bitene kadar kasanıza aktarılmaktadır.
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ACTIVE TREATIES */}
                    {activeList.map((tr) => {
                      const partnerId = tr.fromId === myCountry.id ? tr.toId : tr.fromId;
                      const partner =
                        (hud.allCountries || []).find((c) => c.id === partnerId) ||
                        engineRef.current?.countryMap.get(partnerId);
                      const isAlliance = tr.type === "ALLIANCE";
                      const isPayer = tr.tributePayerId === myCountry.id;

                  return (
                    <div
                      key={tr.id}
                      className="p-3 sm:p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col gap-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/40 shadow-sm"
                            style={{ backgroundColor: partner?.color || "#94A3B8" }}
                          />
                          <span className="font-black text-sm text-white">
                            {partner?.name || "Bilinmeyen Devlet"}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-black text-[10px] tracking-wide uppercase ${
                            isAlliance
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {isAlliance ? "İttifak (Saldırmazlık)" : "Haraç Anlaşması"}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 bg-slate-900/60 rounded-xl p-2.5 border border-slate-800/80 space-y-1">
                        {isAlliance ? (
                          <div className="text-slate-300">
                            İki devlet birbirinin topraklarına saldıramaz. Saldıran taraf ceza öder.
                          </div>
                        ) : (
                          <div className="font-bold flex items-center gap-1.5">
                            <Coins size={14} className="text-amber-400 shrink-0" />
                            {isPayer ? (
                              <span className="text-rose-300">
                                Sen bu devlete barış için her dakika <strong className="text-amber-400">{tr.tributeAmount} Altın</strong> ödüyorsun.
                              </span>
                            ) : (
                              <span className="text-emerald-300">
                                Bu devlet sana barış için her dakika <strong className="text-amber-400">{tr.tributeAmount} Altın</strong> ödüyor.
                              </span>
                            )}
                          </div>
                        )}
                        <div className="text-slate-400 text-[10px] flex items-center justify-between pt-1 border-t border-slate-800">
                          <span>İhlal / Fesih Cezası:</span>
                          <span className="font-black text-amber-400">{tr.penalty} Altın</span>
                        </div>
                      </div>

                      {tr.terminationRequestedBy === myCountry.id ? (
                        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold">
                            <RefreshCw size={13} className="animate-spin text-amber-400 shrink-0" />
                            <span>Fesih isteği gönderildi, karşı tarafın onayı bekleniyor...</span>
                          </div>
                          <button
                            onClick={() => handleCancelTerminationRequest(tr.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-black shrink-0 transition"
                          >
                            İptal Et
                          </button>
                        </div>
                      ) : tr.terminationRequestedBy && tr.terminationRequestedBy !== myCountry.id ? (
                        <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs space-y-2">
                          <div className="text-rose-200 font-bold flex items-center gap-1.5">
                            <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                            <span>Karşı taraf anlaşmayı karşılıklı feshetmek istiyor. Kabul ederseniz iki taraftan da hiçbir ceza kesilmeden anlaşma bozulacaktır.</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleAcceptTreatyTermination(tr.id)}
                              className="py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1 transition"
                            >
                              <Check size={14} />
                              <span>Feshi Onayla (Cezasız)</span>
                            </button>
                            <button
                              onClick={() => handleRejectTreatyTermination(tr.id)}
                              className="py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold text-xs flex items-center justify-center gap-1 transition"
                            >
                              <X size={14} />
                              <span>Reddet</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <button
                            onClick={() => handleRequestTreatyTermination(tr.id)}
                            className="w-full py-2 rounded-xl bg-gradient-to-r from-rose-500/15 to-amber-500/15 hover:from-rose-500/25 hover:to-amber-500/25 border border-rose-500/30 text-amber-200 font-bold text-xs transition flex items-center justify-center gap-1.5 active:scale-95"
                            title="Karşı tarafa fesih isteği gönderir, kabul edilirse cezasız bozulur"
                          >
                            <Handshake size={14} className="text-amber-400" />
                            <span>Anlaşmayı Feshet (İstek Gönder - Cezasız)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelTreaty(tr.id)}
                            className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold text-center w-full py-0.5 transition"
                          >
                            Tek taraflı boz ({tr.penalty} Altın Ceza)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

              {/* TAB 2: INCOMING PROPOSALS */}
              {diplomacyTab === "INCOMING" && (() => {
                const incomingList = treatiesList.filter(
                  (t) => t.status === "PENDING" && t.toId === myCountry.id
                );
                const incomingTerminations = treatiesList.filter(
                  (t) =>
                    t.status === "ACTIVE" &&
                    (t.fromId === myCountry.id || t.toId === myCountry.id) &&
                    t.terminationRequestedBy &&
                    t.terminationRequestedBy !== myCountry.id
                );

                if (incomingList.length === 0 && incomingTerminations.length === 0) {
                  return (
                    <div className="text-center py-8 px-4 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-slate-400">
                      <FileText size={32} className="mx-auto mb-2 text-slate-600" />
                      <div className="text-xs font-bold text-slate-300">
                        Gelen bir anlaşma veya fesih teklifi yok
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                        Diğer oyuncular sana bir anlaşma veya cezasız fesih teklif ettiğinde burada görünecektir.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {/* INCOMING TERMINATION REQUESTS */}
                    {incomingTerminations.map((tr) => {
                      const partnerId = tr.fromId === myCountry.id ? tr.toId : tr.fromId;
                      const partner = (hud.allCountries || []).find((c) => c.id === partnerId) || engineRef.current?.countryMap.get(partnerId);
                      return (
                        <div
                          key={`term_${tr.id}`}
                          className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 shadow-lg space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-xs text-rose-300 flex items-center gap-1.5">
                              <AlertTriangle size={15} className="text-rose-400" />
                              <span>Fesih Teklifi: {partner?.name || "Müttefik"}</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Cezasız Fesih
                            </span>
                          </div>
                          <p className="text-xs text-slate-200">
                            <strong>{partner?.name || "Karşı devlet"}</strong>, aranızdaki {tr.type === "ALLIANCE" ? "İttifak" : "Haraç"} anlaşmasını karşılıklı olarak feshetmek istiyor. Onaylarsanız hiçbir ceza kesilmeden anlaşma barışçıl şekilde bozulacaktır.
                          </p>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              onClick={() => handleRejectTreatyTermination(tr.id)}
                              className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-black text-xs flex items-center justify-center gap-1.5 transition"
                            >
                              <XCircle size={14} />
                              <span>Reddet</span>
                            </button>
                            <button
                              onClick={() => handleAcceptTreatyTermination(tr.id)}
                              className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition"
                            >
                              <Check size={14} />
                              <span>Feshi Onayla (Cezasız)</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* INCOMING PROPOSALS */}
                    {incomingList.map((tr) => {
                      const sender = (hud.allCountries || []).find((c) => c.id === tr.fromId) || engineRef.current?.countryMap.get(tr.fromId);
                      const isAlliance = tr.type === "ALLIANCE";
                      const iWouldPay = tr.tributePayerId === myCountry.id;

                      return (
                        <div
                          key={tr.id}
                          className="p-3 sm:p-3.5 rounded-2xl bg-slate-800/80 border border-indigo-500/40 flex flex-col gap-2.5 shadow-lg shadow-indigo-950/40"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/40 shadow-sm"
                                style={{ backgroundColor: sender?.color || "#94A3B8" }}
                              />
                              <span className="font-black text-sm text-white">
                                {sender?.name || "Bilinmeyen Devlet"}
                              </span>
                            </div>
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-black text-[10px] tracking-wide uppercase ${
                                isAlliance
                                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              }`}
                            >
                              {isAlliance ? "İttifak Teklifi" : "Haraç Teklifi"}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-200 bg-slate-900/70 rounded-xl p-2.5 border border-slate-800 space-y-1.5">
                            {tr.type === "LAND_PURCHASE" ? (
                              <div className="text-amber-200">
                                Bu devlet sizden <strong className="text-amber-400">{tr.landPixelCount} piksel</strong> sınır toprağınızı toplam <strong className="text-amber-400">{tr.landTotalPrice?.toLocaleString()} Altın</strong> karşılığında satın almak istiyor.
                              </div>
                            ) : isAlliance ? (
                              <div>
                                Bu devlet seninle <strong>saldırmazlık paktı</strong> imzalamak istiyor. Anlaşma süresince birbirinize saldıramazsınız.
                              </div>
                            ) : iWouldPay ? (
                              <div className="text-amber-200">
                                Bu devlet sana saldırmama karşılığında dakikada <strong className="text-amber-400 font-black">{tr.tributeAmount} Altın</strong> haraç talep ediyor.
                              </div>
                            ) : (
                              <div className="text-emerald-300">
                                Bu devlet ona saldırmaman karşılığında sana dakikada <strong className="text-amber-400 font-black">{tr.tributeAmount} Altın</strong> ödemeyi teklif ediyor.
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
                              <span>{tr.type === "LAND_PURCHASE" ? "Satış Türü:" : "Anlaşmayı bozana ceza tazminatı:"}</span>
                              <span className="font-black text-amber-400">
                                {tr.type === "LAND_PURCHASE" ? "Peşin Altın Ödemesi" : `${tr.penalty} Altın`}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              onClick={() => handleRejectTreaty(tr.id)}
                              className="py-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-300 font-black text-xs transition flex items-center justify-center gap-1.5"
                            >
                              <XCircle size={14} />
                              <span>Reddet</span>
                            </button>
                            <button
                              onClick={() => handleAcceptTreaty(tr.id)}
                              className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                            >
                              <Check size={14} />
                              <span>{tr.type === "LAND_PURCHASE" ? "Satışı Onayla (Altını Al)" : "Kabul Et"}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* TAB 3: NEW TREATY PROPOSAL FORM */}
              {diplomacyTab === "NEW" && (() => {
                const countries = [];
                const seen = new Set();
                for (const c of hud.allCountries || []) {
                  if (c.id !== myCountry.id && c.landCount > 0 && !seen.has(c.id)) {
                    seen.add(c.id);
                    countries.push(c);
                  }
                }
                countries.sort((a, b) => b.landCount - a.landCount);

                return (
                  <div className="space-y-3.5">
                    {/* Target Country Selection */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Hedef Devlet Seç
                      </label>
                      <select
                        value={targetCountryId}
                        onChange={(e) => setTargetCountryId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:border-indigo-400"
                      >
                        <option value="">-- Devlet Seçin --</option>
                        {countries.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.landCount} px)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Treaty Type Toggle */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Anlaşma Türü
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTreatyType("ALLIANCE")}
                          className={`p-2.5 rounded-2xl border text-left transition flex flex-col gap-0.5 ${
                            treatyType === "ALLIANCE"
                              ? "bg-indigo-600/20 border-indigo-500 text-white"
                              : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-1 font-black text-[11px] text-white">
                            <Shield size={12} className="text-indigo-400" />
                            <span>İttifak</span>
                          </div>
                          <span className="text-[9px] text-slate-400 leading-tight">
                            Saldırmazlık
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTreatyType("TRIBUTE")}
                          className={`p-2.5 rounded-2xl border text-left transition flex flex-col gap-0.5 ${
                            treatyType === "TRIBUTE"
                              ? "bg-amber-500/20 border-amber-500 text-white"
                              : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-1 font-black text-[11px] text-white">
                            <Coins size={12} className="text-amber-400" />
                            <span>Haraç</span>
                          </div>
                          <span className="text-[9px] text-slate-400 leading-tight">
                            Dakikalık Altın
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTreatyType("LAND_PURCHASE")}
                          className={`p-2.5 rounded-2xl border text-left transition flex flex-col gap-0.5 ${
                            treatyType === "LAND_PURCHASE"
                              ? "bg-emerald-500/20 border-emerald-500 text-white"
                              : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-1 font-black text-[11px] text-white">
                            <FileText size={13} className="text-emerald-400" />
                            <span>Toprak Satın Al</span>
                          </div>
                          <span className="text-[9px] text-slate-400 leading-tight">
                            Parayla Genişle
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Tribute Specific Options */}
                    {treatyType === "TRIBUTE" && (
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                        <div>
                          <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                            Haraç Yönü
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setTributeRole("RECEIVER")}
                              className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition ${
                                tributeRole === "RECEIVER"
                                  ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow"
                                  : "bg-slate-800 border-slate-700 text-slate-300"
                              }`}
                            >
                              Onlar Bana Ödesin
                            </button>
                            <button
                              type="button"
                              onClick={() => setTributeRole("PAYER")}
                              className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition ${
                                tributeRole === "PAYER"
                                  ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow"
                                  : "bg-slate-800 border-slate-700 text-slate-300"
                              }`}
                            >
                              Ben Onlara Ödeyeyim
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                            Dakikalık Altın Miktarı (Altın / dk)
                          </label>
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="number"
                              min="1"
                              max="1000000"
                              value={tributeAmount}
                              onChange={(e) => setTributeAmount(Math.max(1, parseInt(e.target.value) || 0))}
                              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/50 text-white font-black text-xs focus:outline-none focus:border-amber-400"
                              placeholder="Örn: 250"
                            />
                            <span className="text-xs font-black text-amber-400 shrink-0">Altın / dk</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[50, 100, 250, 500].map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => setTributeAmount(amt)}
                                className={`py-1.5 rounded-xl text-xs font-bold border transition ${
                                  tributeAmount === amt
                                    ? "bg-amber-400 text-slate-950 border-amber-300 font-black"
                                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                                }`}
                              >
                                {amt} / dk
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Land Purchase Specific Options */}
                    {treatyType === "LAND_PURCHASE" && (
                      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                        <div>
                          <label className="block text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1">
                            Satın Alınacak Toprak Miktarı (Piksel Sayısı)
                          </label>
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="number"
                              min="1"
                              max="5000"
                              value={landPixelCount}
                              onChange={(e) => setLandPixelCount(Math.max(1, parseInt(e.target.value) || 0))}
                              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/50 text-white font-black text-xs focus:outline-none focus:border-emerald-400"
                              placeholder="Örn: 50"
                            />
                            <span className="text-xs font-black text-emerald-400 shrink-0">Piksel (px)</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[10, 25, 50, 100].map((pxCount) => (
                              <button
                                key={pxCount}
                                type="button"
                                onClick={() => setLandPixelCount(pxCount)}
                                className={`py-1.5 rounded-xl text-xs font-bold border transition ${
                                  landPixelCount === pxCount
                                    ? "bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow"
                                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                                }`}
                              >
                                {pxCount} px
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1">
                            Piksel Başına Teklif (Altın / Piksel)
                          </label>
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="number"
                              min="1"
                              max="100000"
                              value={landPricePerPixel}
                              onChange={(e) => setLandPricePerPixel(Math.max(1, parseInt(e.target.value) || 0))}
                              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/50 text-white font-black text-xs focus:outline-none focus:border-emerald-400"
                              placeholder="Örn: 100"
                            />
                            <span className="text-xs font-black text-amber-400 shrink-0">Altın / px</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[25, 50, 100, 250].map((price) => (
                              <button
                                key={price}
                                type="button"
                                onClick={() => setLandPricePerPixel(price)}
                                className={`py-1.5 rounded-xl text-xs font-bold border transition ${
                                  landPricePerPixel === price
                                    ? "bg-amber-400 text-slate-950 border-amber-300 font-black shadow"
                                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                                }`}
                              >
                                {price} Altın
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 text-xs flex items-center justify-between">
                          <span className="text-slate-300 font-bold">Toplam Teklif Tutarı:</span>
                          <span className="text-amber-400 font-black text-sm">
                            {(landPixelCount * landPricePerPixel).toLocaleString()} Altın
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Penalty Selection (for Alliance and Tribute) */}
                    {treatyType !== "LAND_PURCHASE" && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                          Anlaşma İhlal / Fesih Cezası
                        </label>
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="number"
                            min="0"
                            max="5000000"
                            value={penaltyAmount}
                            onChange={(e) => setPenaltyAmount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-rose-500/50 text-white font-black text-xs focus:outline-none focus:border-rose-400"
                            placeholder="Örn: 5000"
                          />
                          <span className="text-xs font-black text-rose-400 shrink-0">Altın Tazminat</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[1000, 2500, 5000, 10000].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setPenaltyAmount(amt)}
                              className={`py-1.5 rounded-xl text-xs font-bold border transition ${
                                penaltyAmount === amt
                                  ? "bg-rose-500 text-white border-rose-400 font-black"
                                  : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                              }`}
                            >
                              {amt} Altın
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Anlaşmayı tek taraflı bozan veya müttefikine saldıran taraf bu cezayı karşı tarafa tazminat olarak öder.
                        </p>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="button"
                      onClick={handleSendTreatyProposal}
                      disabled={!targetCountryId}
                      className={`w-full py-3 rounded-2xl font-black text-xs transition flex items-center justify-center gap-2 shadow-xl ${
                        targetCountryId
                          ? "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white active:scale-95 shadow-indigo-600/30"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      <Handshake size={16} />
                      <span>Teklifi Karşı Devlete Gönder</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TREATY ATTACK VIOLATION CONFIRMATION MODAL */}
      {treatyWarningModal && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-rose-500 rounded-3xl p-5 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
              <Shield size={28} />
            </div>

            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black text-[10px] tracking-wider uppercase">
                Anlaşma İhlali Uyarısı
              </span>
              <h3 className="text-base font-black text-white mt-2">
                Müttefik Toprağına Saldırıyorsun!
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Bu toprak aranızda anlaşma olan{" "}
                <strong className="text-amber-300">
                  {treatyWarningModal.targetCountry?.name || "Müttefik Devlet"}
                </strong>{" "}
                devletine aittir.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-left text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-rose-300 font-bold flex items-center gap-1.5">
                  <Coins size={14} className="text-amber-400 shrink-0" />
                  <span>Ceza Tazminatı:</span>
                </div>
                <div className="text-amber-400 font-black text-sm">
                  {treatyWarningModal.treaty?.penalty || 2500} Altın
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-rose-500/20">
                <div className="text-slate-400">
                  Kasadaki Altın:{" "}
                  <strong className="text-white">
                    {Math.floor(myCountry?.gold || 0)}
                  </strong>
                </div>
                <div className="text-slate-400 text-right">
                  {(myCountry?.gold || 0) < (treatyWarningModal.treaty?.penalty || 2500) ? (
                    <span className="text-rose-400 font-bold">
                      Kalan Borç:{" "}
                      {(treatyWarningModal.treaty?.penalty || 2500) - Math.floor(myCountry?.gold || 0)} Altın
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-bold">Tamamı Kasadan</span>
                  )}
                </div>
              </div>

              {(myCountry?.gold || 0) < (treatyWarningModal.treaty?.penalty || 2500) ? (
                <p className="text-[10px] text-amber-200/90 leading-tight bg-amber-950/40 p-2 rounded-xl border border-amber-500/30">
                  ⚠️ <strong>Yetersiz Altın:</strong> Kasandaki tüm altın (
                  {Math.floor(myCountry?.gold || 0)} Altın) kurbana verilecek. Kalan{" "}
                  {(treatyWarningModal.treaty?.penalty || 2500) - Math.floor(myCountry?.gold || 0)}{" "}
                  Altın borç tamamlanana kadar <u>ürettiğin tüm altınlar</u> otomatik olarak mağdur devlete tazminat olarak aktarılacaktır!
                </p>
              ) : (
                <p className="text-[10px] text-slate-400">
                  Saldırıya devam ederseniz anlaşma derhal bozulacak ve ceza kasanızdan kesilip müttefikinize aktarılacaktır.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTreatyWarningModal(null)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition active:scale-95"
              >
                Vazgeç (Saldırma)
              </button>
              <button
                type="button"
                onClick={handleConfirmTreatyBreakAndAttack}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition shadow-lg shadow-rose-600/30 active:scale-95"
              >
                Anlaşmayı Boz & Saldır
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NUCLEAR TARGETING ACTIVE BANNER */}
      {isTargetingNuke && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-rose-950/95 border-2 border-rose-500 text-rose-100 px-4 py-2 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-3 animate-bounce">
          <LogoNuclear size={20} className="text-rose-400" />
          <span>HEDEF SEÇİMİ: Haritada nükleer başlığı vurmak istediğin noktaya dokun!</span>
          <button
            onClick={() => setIsTargetingNuke(false)}
            className="px-2 py-0.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-[11px]"
          >
            İptal
          </button>
        </div>
      )}

      {/* NUCLEAR STRIKE CONFIRMATION MODAL */}
      {nukeConfirmModal && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-rose-600 rounded-3xl p-5 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-rose-600/20 border border-rose-500/50 text-rose-400 flex items-center justify-center mx-auto text-xs font-black shadow-lg shadow-rose-600/30">
              <LogoNuclear size={36} />
            </div>

            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black text-[10px] tracking-wider uppercase">
                Süper Silah: Taktik Nükleer
              </span>
              <h3 className="text-lg font-black text-white mt-1.5">
                Nükleer Taarruz Onayı!
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                <strong className="text-amber-400">({nukeConfirmModal.x}, {nukeConfirmModal.y})</strong> koordinatına taktik nükleer başlık fırlatılacak.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-left text-xs space-y-1.5 text-slate-200">
              <div className="flex items-center justify-between text-amber-400 font-black">
                <span>Harcanacak Cephane:</span>
                <span>Depodan 1 Adet Taktik Nükleer</span>
              </div>
              <p className="text-[11px] text-rose-200">
                22 piksel yarıçapındaki tüm topraklar ve ordular yok edilecek. Bölge 1 gün boyunca radyoaktif ve fethedilemez çorak alana dönüşecektir!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setNukeConfirmModal(null)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition active:scale-95"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmNukeStrike}
                className="py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs transition shadow-lg shadow-rose-600/40 active:scale-95"
              >
                Fırlat & Ateşle!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MARKET & ENVANTER MODAL */}
      {showMarket && myCountry && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    Market & Envanter
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    Paralı asker kiralayın, nükleer silah depolayın ve cephaneliğinizi yönetin
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowMarket(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Current Resources Bar */}
            <div className="my-3 p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-300">
                <LogoGold size={15} />
                <span>Kasa: <strong className="text-amber-400">{Math.floor(myCountry.gold).toLocaleString()} Altın</strong></span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-slate-300">
                <LogoSwords size={15} />
                <span>Ordu: <strong className="text-emerald-400">{myCountry.troops.toFixed(1)} / {Math.floor(myCountry.capacity)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-slate-300">
                <ShieldAlert size={15} className="text-rose-400" />
                <span>Nükleer: <strong className="text-rose-400">{myCountry.inventory?.nukes || 0} Adet</strong></span>
              </div>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-1.5 mb-3 bg-slate-950/60 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setMarketTab("STORE")}
                className={`py-2 rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1.5 transition ${
                  marketTab === "STORE"
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ShoppingBag size={14} />
                <span>Market</span>
              </button>
              <button
                type="button"
                onClick={() => setMarketTab("UPGRADES")}
                className={`py-2 rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1.5 transition ${
                  marketTab === "UPGRADES"
                    ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <LogoCitadel size={14} />
                <span>Geliştir</span>
              </button>
              <button
                type="button"
                onClick={() => setMarketTab("OWNED")}
                className={`py-2 rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1.5 transition relative ${
                  marketTab === "OWNED"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Package size={14} />
                <span>Envanter</span>
                {(myCountry.inventory?.nukes || 0) > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                    {myCountry.inventory.nukes}
                  </span>
                )}
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 custom-scrollbar">
              {marketTab === "UPGRADES" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {UPGRADE_DEFINITIONS.map((u) => {
                    const lvl = myCountry.upgrades?.[u.key] || 0;
                    const isMax = lvl >= u.maxLevel;
                    const cost = Math.round(u.baseCost * Math.pow(u.costScale, lvl));
                    const canAfford = (myCountry.gold || 0) >= cost;
                    return (
                      <div
                        key={u.key}
                        className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700/80 flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 font-black text-xs text-white">
                              <LogoCitadel size={14} className="text-amber-400 shrink-0" />
                              <span>{u.name}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black">
                              Sv.{lvl}/{u.maxLevel}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-relaxed">{u.desc}</p>
                        </div>
                        <button
                          type="button"
                          disabled={isMax || !canAfford}
                          onClick={() => {
                            const res = engineRef.current?.buyUpgrade(myCountry.id, u.key);
                            if (!res?.ok) {
                              showToast(res?.reason || "Geliştirme yapılamadı.");
                            } else {
                              showToast(`${u.name} Seviye ${lvl + 1} oldu!`);
                            }
                          }}
                          className={`w-full py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition ${
                            isMax
                              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                              : canAfford
                                ? "bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95"
                                : "bg-slate-700/80 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          {isMax ? (
                            <span>MAKSİMUM</span>
                          ) : (
                            <>
                              <LogoGold size={13} />
                              <span>Yükselt ({cost.toLocaleString()} Altın)</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : marketTab === "STORE" ? (
                <>
                  {/* MERCENARIES (PARALI ASKER) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-yellow-500/5 border border-amber-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LogoSwords size={20} className="text-amber-400" />
                        <div>
                          <div className="text-xs font-black text-amber-300">
                            Paralı Asker Birliği
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Altın ödeyerek anında profesyonel asker transfer et
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                        1 Asker = 250 Altın
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {[
                        { count: 5, cost: 1250 },
                        { count: 10, cost: 2500 },
                        { count: 25, cost: 6250 },
                        { count: 50, cost: 12500 },
                      ].map(({ count, cost }) => {
                        const canAfford = myCountry.gold >= cost;
                        return (
                          <button
                            key={count}
                            type="button"
                            disabled={!canAfford}
                            onClick={() => handleBuyMercenaries(count)}
                            className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center transition active:scale-95 ${
                              canAfford
                                ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md cursor-pointer"
                                : "bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed"
                            }`}
                          >
                            <span className="text-xs font-black">+{count} Asker</span>
                            <span className="text-[10px] font-bold opacity-90">
                              {cost.toLocaleString()} Altın
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* POPULATION SUPPORT BOOST (HALKA NÜFUS DESTEĞİ) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 to-cyan-500/5 border border-sky-500/35 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <LogoPopulation size={20} className="text-sky-400 shrink-0" />
                        <div>
                          <div className="text-xs font-black text-sky-300">
                            Halka Nüfus Desteği Ver
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Seçilen süre boyunca nüfus artış hızını +%50 artırır (Fiyat nüfusuna göre ölçeklenir)
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded-full border border-sky-500/30 shrink-0">
                        +%50 Hız
                      </span>
                    </div>

                    {myCountry.popBoostUntil > Date.now() && (() => {
                      const remSec = Math.max(0, Math.ceil((myCountry.popBoostUntil - Date.now()) / 1000));
                      const h = Math.floor(remSec / 3600);
                      const m = Math.floor((remSec % 3600) / 60);
                      const s = remSec % 60;
                      const remText = h > 0 ? `${h} sa ${m} dk` : m > 0 ? `${m} dk ${s} sn` : `${s} sn`;
                      return (
                        <div className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 flex items-center justify-between">
                          <span>Aktif Nüfus Desteği (+%50)</span>
                          <span className="font-black text-white">Kalan: {remText}</span>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {POP_SUPPORT_TIERS.map((tier) => {
                        const cost = getPopSupportCost(myCountry.population, tier.baseCost);
                        const canAfford = myCountry.gold >= cost;
                        return (
                          <button
                            key={tier.key}
                            type="button"
                            disabled={!canAfford}
                            onClick={() => handleBuyPopulationSupport(tier.key)}
                            className={`py-2 px-1.5 rounded-xl text-center flex flex-col items-center justify-center transition active:scale-95 ${
                              canAfford
                                ? "bg-sky-500 hover:bg-sky-400 text-slate-950 font-black shadow-md cursor-pointer"
                                : "bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed"
                            }`}
                          >
                            <span className="text-xs font-black">{tier.label}</span>
                            <span className="text-[10px] font-bold opacity-90">
                              {cost.toLocaleString()} Altın
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* NUCLEAR WEAPON (TAKTIK NUKLEER) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/60 to-red-950/30 border border-rose-500/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-rose-600/20 border border-rose-500/50 text-rose-400 flex items-center justify-center text-xs font-black">
                          <LogoNuclear size={20} />
                        </div>
                        <div>
                          <div className="text-xs font-black text-rose-300">
                            Taktik Nükleer Silah
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Kitle İmha Başlığı (22 Piksel Etki Yarıçapı)
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">
                        65.000 Altın
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Satın alındığında <strong className="text-amber-400">envanterinizde depolanır</strong>. Dilediğiniz zaman "Sahip Oldukların" sekmesine gelip haritadaki herhangi bir noktaya fırlatabilirsiniz. Vurulan bölge tamamen yok edilir ve 1 gün boyunca radyasyon alanına dönüşür.
                    </p>

                    <button
                      type="button"
                      disabled={myCountry.gold < 65000}
                      onClick={handleBuyNuclear}
                      className={`w-full py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition shadow-lg active:scale-95 ${
                        myCountry.gold >= 65000
                          ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30 cursor-pointer"
                          : "bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed"
                      }`}
                    >
                      <LogoNuclear size={16} />
                      <span>Satın Al ve Depola (-65.000 Altın)</span>
                    </button>
                  </div>
                </>
              ) : (
                /* TAB: OWNED / INVENTORY (SAHİP OLDUKLARIN) */
                <div className="space-y-3">
                  {/* NUKES INVENTORY */}
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-xs font-black shadow">
                          <LogoNuclear size={24} />
                        </div>
                        <div>
                          <div className="text-xs font-black text-white">
                            Taktik Nükleer Silah
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Depodaki Miktar: <strong className="text-amber-400 font-black">{myCountry.inventory?.nukes || 0} Adet</strong>
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        (myCountry.inventory?.nukes || 0) > 0
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-slate-700/50 text-slate-400"
                      }`}>
                        {(myCountry.inventory?.nukes || 0) > 0 ? "Fırlatmaya Hazır" : "Depoda Yok"}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      "Kullan" butonuna dokunduktan sonra haritada patlatmak istediğiniz koordinata dokunun. Depodan 1 adet harcanır ve ilave altın kesilmez.
                    </p>

                    <button
                      type="button"
                      disabled={!(myCountry.inventory?.nukes > 0)}
                      onClick={() => {
                        setShowMarket(false);
                        setIsTargetingNuke(true);
                      }}
                      className={`w-full py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 ${
                        myCountry.inventory?.nukes > 0
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 cursor-pointer"
                          : "bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed"
                      }`}
                    >
                      <Zap size={14} />
                      <span>Kullan (1 Tane Fırlat)</span>
                    </button>
                  </div>

                  {/* SUMMARY STATS CARD */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs text-slate-300">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Shield size={14} className="text-indigo-400" />
                      <span>Mülk & Savunma Durumu</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Toplam Toprak:</span>
                        <span className="font-black text-white">{myCountry.landCount} Piksel</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Ordu Kuvveti:</span>
                        <span className="font-black text-emerald-400">{Math.floor(myCountry.troops)} Asker</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOAST MESSAGE */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-amber-400/50 text-white px-4 py-2 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2">
          <Sparkles size={15} className="text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
